# PromptGate tray (phase 2). PowerShell 5.1 + WinForms host: tray icon, global hotkey, popup.
# The scoring engine runs in Node (tray/core.js -> scripts/lib/engine.js); this file never parses
# prompt text. It is ASCII-only on purpose: every user-facing string comes from
# `node tray/core.js --ui` (VI/EN in tray/lib/compose.js), so PowerShell's ANSI default encoding
# for .ps1 files can never garble Vietnamese.
#
# Run:  npm run tray            (console stays open, handy for debugging)
#       tray\PromptGate.cmd     (hidden, background)
# Data: %USERPROFILE%\.claude\promptgate\config.json  ("tray" section), tray.log
#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:RepoRoot   = Split-Path -Parent $script:ScriptDir
$script:CoreJs     = Join-Path $script:ScriptDir 'core.js'
$script:HistoryJs  = Join-Path $script:RepoRoot 'scripts\history.js'
$script:ClaudeDir  = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $env:USERPROFILE '.claude' }
$script:DataDir    = Join-Path $script:ClaudeDir 'promptgate'
$script:ConfigFile = Join-Path $script:DataDir 'config.json'
$script:LogFile    = Join-Path $script:DataDir 'tray.log'
$script:TmpDir     = Join-Path $env:TEMP 'promptgate-tray'
$script:Utf8       = New-Object System.Text.UTF8Encoding($false)
New-Item -ItemType Directory -Force -Path $script:DataDir | Out-Null
New-Item -ItemType Directory -Force -Path $script:TmpDir | Out-Null

function Write-Log([string]$msg) {
    try { Add-Content -Path $script:LogFile -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $msg) -Encoding UTF8 } catch {}
}

# ---- Guards -----------------------------------------------------------------
if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    [System.Windows.Forms.MessageBox]::Show('PromptGate tray needs an STA thread. Run: powershell -STA -File tray\PromptGate.ps1 (or use PromptGate.cmd).', 'PromptGate') | Out-Null
    exit 1
}
$script:Mutex = New-Object System.Threading.Mutex($false, 'Local\PromptGateTray')
if (-not $script:Mutex.WaitOne(0, $false)) { Write-Log 'another instance is running; exit'; exit 0 }

# ---- Win32 + hotkey window ---------------------------------------------------
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class PgNative {
    [DllImport("user32.dll", SetLastError=true)] public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);
    [DllImport("user32.dll")] public static extern bool UnregisterHotKey(IntPtr hWnd, int id);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    public static string Title(IntPtr h) { StringBuilder sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
    public static void KeyDown(byte vk) { keybd_event(vk, 0, 0, UIntPtr.Zero); }
    public static void KeyUp(byte vk) { keybd_event(vk, 0, 2, UIntPtr.Zero); }
    public static int LastError() { return Marshal.GetLastWin32Error(); }
}
public class PgHotkeyWindow : NativeWindow {
    public event EventHandler Pressed;
    public PgHotkeyWindow() { CreateHandle(new CreateParams()); }
    protected override void WndProc(ref Message m) {
        if (m.Msg == 0x0312) { EventHandler h = Pressed; if (h != null) h(this, EventArgs.Empty); }
        base.WndProc(ref m);
    }
    public bool Register(uint mods, uint vk) { PgNative.UnregisterHotKey(Handle, 1); return PgNative.RegisterHotKey(Handle, 1, mods | 0x4000, vk); }
    public void Unregister() { PgNative.UnregisterHotKey(Handle, 1); }
}
"@

# ---- JSON / config helpers ---------------------------------------------------
function Read-Json([string]$path) {
    try { if (Test-Path $path) { return ([IO.File]::ReadAllText($path, [Text.Encoding]::UTF8) | ConvertFrom-Json) } } catch { Write-Log "read json failed ${path}: $_" }
    return $null
}
function Write-Json([string]$path, $obj) { [IO.File]::WriteAllText($path, ($obj | ConvertTo-Json -Depth 10), $script:Utf8) }

function Save-TrayConfig {
    $cfg = Read-Json $script:ConfigFile
    if (-not $cfg) { $cfg = New-Object PSObject }
    $t = New-Object PSObject
    foreach ($k in 'hotkey', 'paste', 'llm', 'enabled', 'node', 'language') { $t | Add-Member -NotePropertyName $k -NotePropertyValue $script:Tray[$k] }
    $cfg | Add-Member -NotePropertyName tray -NotePropertyValue $t -Force
    Write-Json $script:ConfigFile $cfg
    Write-Log ("config saved: hotkey=" + $script:Tray.hotkey + " paste=" + $script:Tray.paste + " llm=" + $script:Tray.llm + " enabled=" + $script:Tray.enabled)
}

# ---- Node bridge -------------------------------------------------------------
function Find-Node {
    $cands = @()
    $cfg = Read-Json $script:ConfigFile
    if ($cfg -and $cfg.tray -and $cfg.tray.node) { $cands += [string]$cfg.tray.node }
    $cmd = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($cmd) { $cands += $cmd.Source }
    $cands += (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    $cands += (Join-Path $env:LOCALAPPDATA 'Programs\nodejs\node.exe')
    $cands += (Join-Path $env:APPDATA 'nvm\current\node.exe')
    $cands += (Join-Path $env:LOCALAPPDATA 'Volta\bin\node.exe')
    foreach ($c in $cands) { if ($c -and (Test-Path $c)) { return $c } }
    return $null
}

function Quote-Arg([string]$a) { if ($a -match '[\s"]') { return '"' + ($a -replace '"', '\"') + '"' } else { return $a } }

function Start-Node([string]$scriptPath, [string[]]$nodeArgs) {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $script:NodeExe
    $parts = @((Quote-Arg $scriptPath))
    foreach ($a in $nodeArgs) { $parts += (Quote-Arg $a) }
    $psi.Arguments = ($parts -join ' ')
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.StandardOutputEncoding = [Text.Encoding]::UTF8
    $psi.StandardErrorEncoding = [Text.Encoding]::UTF8
    $psi.WorkingDirectory = $script:RepoRoot
    return [System.Diagnostics.Process]::Start($psi)
}

# Runs a Node script to completion; returns stdout (UTF-8) or $null on timeout.
function Invoke-Node([string]$scriptPath, [string[]]$nodeArgs, [int]$timeoutMs) {
    $p = Start-Node $scriptPath $nodeArgs
    $outTask = $p.StandardOutput.ReadToEndAsync()
    $errTask = $p.StandardError.ReadToEndAsync()
    if (-not $p.WaitForExit($timeoutMs)) { try { $p.Kill() } catch {}; Write-Log ("node timeout: " + $scriptPath + ' ' + ($nodeArgs -join ' ')); return $null }
    $err = $errTask.Result
    if ($err -and $err.Trim()) { Write-Log ("node stderr: " + $err.Trim()) }
    return $outTask.Result
}
function Invoke-CoreJson([string[]]$coreArgs, [int]$timeoutMs) {
    $out = Invoke-Node $script:CoreJs $coreArgs $timeoutMs
    if (-not $out) { return $null }
    try { return ($out | ConvertFrom-Json) } catch { Write-Log ("core bad json: " + $out.Substring(0, [Math]::Min(300, $out.Length))); return $null }
}

# ---- Hotkey ------------------------------------------------------------------
function Parse-Hotkey([string]$s) {
    $mods = [uint32]0; $vk = [uint32]0
    foreach ($part in ($s -split '\+')) {
        $pn = $part.Trim()
        if ($pn -match '^(ctrl|control)$') { $mods = $mods -bor 2; continue }
        if ($pn -match '^alt$') { $mods = $mods -bor 1; continue }
        if ($pn -match '^shift$') { $mods = $mods -bor 4; continue }
        if ($pn -match '^(win|windows|meta|super)$') { $mods = $mods -bor 8; continue }
        $name = $pn
        if ($name -match '^\d$') { $name = "D$name" }
        if ($name -match '^(space|spacebar)$') { $name = 'Space' }
        try { $vk = [uint32][int][Enum]::Parse([System.Windows.Forms.Keys], $name, $true) } catch { $vk = 0 }
    }
    return @{ Mods = $mods; Vk = $vk; Valid = (($vk -ne 0) -and ($mods -ne 0)) }
}
function Register-Hotkey {
    $hk = Parse-Hotkey ([string]$script:Tray.hotkey)
    if (-not $hk.Valid) { Write-Log ("invalid hotkey: " + $script:Tray.hotkey); return $false }
    $ok = $script:HotWin.Register($hk.Mods, $hk.Vk)
    if ($ok) { Write-Log ("hotkey registered: " + $script:Tray.hotkey) }
    else { Write-Log ("RegisterHotKey failed: " + $script:Tray.hotkey + " (win32 error " + [PgNative]::LastError() + "; 1409 = already taken by another app)") }
    return $ok
}

# ---- Capture: selection via Ctrl+C, clipboard as fallback -------------------
function Get-SelectionText {
    $fg = [PgNative]::GetForegroundWindow()
    $title = [PgNative]::Title($fg)
    $old = $null
    try { if ([System.Windows.Forms.Clipboard]::ContainsText()) { $old = [System.Windows.Forms.Clipboard]::GetText() } } catch {}
    try { [System.Windows.Forms.Clipboard]::Clear() } catch {}
    # The hotkey's own modifiers are still physically down: release them so Ctrl+C is clean.
    foreach ($vk in 0x12, 0x11, 0x10, 0x5B, 0x5C) { [PgNative]::KeyUp([byte]$vk) }
    Start-Sleep -Milliseconds 40
    [PgNative]::KeyDown(0x11); [PgNative]::KeyDown(0x43); [PgNative]::KeyUp(0x43); [PgNative]::KeyUp(0x11)
    $text = ''
    for ($i = 0; $i -lt 24; $i++) {
        Start-Sleep -Milliseconds 25
        try { if ([System.Windows.Forms.Clipboard]::ContainsText()) { $text = [System.Windows.Forms.Clipboard]::GetText(); if ($text) { break } } } catch {}
    }
    $origin = 'selection'
    if (-not $text -or -not $text.Trim()) {
        $text = $old; $origin = 'clipboard'
        if ($old) { try { [System.Windows.Forms.Clipboard]::SetText($old) } catch {} }
    }
    if ($null -eq $text) { $text = '' }
    return @{ Text = $text; Title = $title; Hwnd = $fg; Origin = $origin; Cursor = [System.Windows.Forms.Cursor]::Position }
}

# ---- Popup -------------------------------------------------------------------
$script:Accent = [System.Drawing.Color]::FromArgb(10, 132, 255)
$script:BgDark = [System.Drawing.Color]::FromArgb(32, 33, 36)
$script:BgBox  = [System.Drawing.Color]::FromArgb(46, 47, 52)
$script:BgBtn  = [System.Drawing.Color]::FromArgb(60, 62, 70)
$script:Muted  = [System.Drawing.Color]::FromArgb(168, 170, 180)
$script:FontBase  = New-Object System.Drawing.Font('Segoe UI', 9.5)
$script:FontSmall = New-Object System.Drawing.Font('Segoe UI', 8.5)
$script:FontHead  = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold)
$script:FontBtn   = New-Object System.Drawing.Font('Segoe UI', 9.5, [System.Drawing.FontStyle]::Bold)

function Measure-Height([string]$text, $font, [int]$width) {
    $sz = [System.Windows.Forms.TextRenderer]::MeasureText($text, $font, (New-Object System.Drawing.Size($width, 0)), [System.Windows.Forms.TextFormatFlags]::WordBreak)
    return $sz.Height
}
function New-Label($parent, [string]$text, [int]$x, [int]$y, [int]$w, $font, $color) {
    $l = New-Object System.Windows.Forms.Label
    $l.AutoSize = $false
    $l.Location = New-Object System.Drawing.Point($x, $y)
    $l.Font = $font; $l.ForeColor = $color; $l.BackColor = [System.Drawing.Color]::Transparent
    $l.Text = $text
    $l.Size = New-Object System.Drawing.Size($w, ((Measure-Height $text $font $w) + 3))
    $parent.Controls.Add($l)
    return $l
}
function Close-Popup {
    if ($script:Popup -and -not $script:Popup.IsDisposed) { try { $script:Popup.Close() } catch {} }
    $script:Popup = $null
}

function Choose-Version([string]$id) {
    if (-not $script:Current -or -not $script:Current.ok) { return }
    $v = $script:Current.versions | Where-Object { $_.id -eq $id } | Select-Object -First 1
    if (-not $v) { return }
    try { [System.Windows.Forms.Clipboard]::SetText([string]$v.text) } catch { Write-Log "clipboard set failed: $_"; return }
    Write-Log ("chose " + $id + " (" + ([string]$v.text).Length + " chars, score " + $script:Current.score + ", " + $script:Current.origin + ")")
    $ui = $script:Current.ui
    if ($script:Tray.paste -and $script:Current.origin -eq 'selection' -and $script:Target -ne [IntPtr]::Zero) {
        $script:Popup.Hide()
        [PgNative]::SetForegroundWindow($script:Target) | Out-Null
        Start-Sleep -Milliseconds 150
        [PgNative]::KeyDown(0x11); [PgNative]::KeyDown(0x56); [PgNative]::KeyUp(0x56); [PgNative]::KeyUp(0x11)
        Start-Sleep -Milliseconds 60
        Write-Log ("pasted " + $id + " into '" + $script:TargetTitle + "'")
        Close-Popup
        return
    }
    if ($script:Status) { $script:Status.Text = ($ui.copied -f $id); $script:Status.ForeColor = [System.Drawing.Color]::FromArgb(120, 220, 140) }
    $script:CloseTimer.Stop(); $script:CloseTimer.Start()
}

function Start-ProRewrite {
    if ($script:ProProc -or -not $script:Current -or -not $script:Current.ok) { return }
    $ui = $script:Current.ui
    $script:ProBtn.Enabled = $false
    $script:Status.Text = $ui.proBusy; $script:Status.ForeColor = $script:Muted
    $req = @{ text = $script:CurrentText; source = $script:TargetTitle; origin = $script:Current.origin; llm = $true; noLog = $true }
    $reqPath = Join-Path $script:TmpDir 'pro-req.json'
    $script:ProOut = Join-Path $script:TmpDir 'pro-out.json'
    if (Test-Path $script:ProOut) { Remove-Item $script:ProOut -Force -ErrorAction SilentlyContinue }
    Write-Json $reqPath $req
    $script:ProProc = Start-Node $script:CoreJs @('--req', $reqPath, '--out', $script:ProOut)
    $script:ProTimer.Start()
}
function Finish-ProRewrite {
    if (-not $script:ProProc) { $script:ProTimer.Stop(); return }
    if (-not $script:ProProc.HasExited) { return }
    $script:ProTimer.Stop()
    $script:ProProc = $null
    if (-not $script:Popup -or $script:Popup.IsDisposed -or -not $script:Current) { return }
    $ui = $script:Current.ui
    $res = Read-Json $script:ProOut
    if ($res -and $res.ok -and $res.llm -eq 'ok') {
        $script:Current.versions = $res.versions
        foreach ($v in $res.versions) { if ($script:Boxes.ContainsKey([string]$v.id)) { $script:Boxes[[string]$v.id].Text = ([string]$v.text) -replace "`r?`n", "`r`n" } }
        $script:Status.Text = $ui.proDone; $script:Status.ForeColor = [System.Drawing.Color]::FromArgb(120, 220, 140)
        Write-Log 'tier-2 rewrite applied'
    } elseif ($res -and $res.llm -eq 'not_pro') {
        $script:Status.Text = $ui.proNotPro; $script:Status.ForeColor = [System.Drawing.Color]::FromArgb(255, 190, 90)
        $script:ProBtn.Enabled = $true
    } else {
        $script:Status.Text = $ui.proFail; $script:Status.ForeColor = [System.Drawing.Color]::FromArgb(255, 190, 90)
        $script:ProBtn.Enabled = $true
        Write-Log 'tier-2 rewrite failed'
    }
}

function Show-Popup($r, $cap) {
    Close-Popup
    $script:Current = $r
    $script:CurrentText = [string]$cap.Text
    $script:Target = $cap.Hwnd
    $script:TargetTitle = [string]$cap.Title
    $script:Boxes = @{}
    $ui = $r.ui
    $W = 620; $pad = 14; $y = $pad
    $f = New-Object System.Windows.Forms.Form
    $f.FormBorderStyle = 'None'; $f.ShowInTaskbar = $false; $f.TopMost = $true; $f.StartPosition = 'Manual'; $f.KeyPreview = $true
    $f.BackColor = $script:BgDark; $f.ForeColor = [System.Drawing.Color]::White; $f.Font = $script:FontBase
    $f.Width = $W
    $script:Popup = $f

    if (-not $r.ok) {
        $y += (New-Label $f ([string]$r.message) $pad $y ($W - 2 * $pad) $script:FontBase ([System.Drawing.Color]::White)).Height + 10
        $y += (New-Label $f ([string]$ui.hint) $pad $y ($W - 2 * $pad) $script:FontSmall $script:Muted).Height
    } else {
        $scoreColor = if ($r.score -lt 50) { [System.Drawing.Color]::FromArgb(255, 99, 99) } elseif ($r.score -lt 75) { [System.Drawing.Color]::FromArgb(255, 200, 80) } else { [System.Drawing.Color]::FromArgb(110, 220, 130) }
        $y += (New-Label $f ([string]$r.header) $pad $y ($W - 2 * $pad - 110) $script:FontHead $scoreColor).Height + 2
        $originText = [string]$ui.origin.($r.origin)
        if ($originText) { $ol = New-Label $f $originText ($W - $pad - 110) ($pad + 4) 110 $script:FontSmall $script:Muted; $ol.TextAlign = 'TopRight' }
        $line2 = @()
        if ($r.missingText) { $line2 += ([string]$ui.missing + ': ' + $r.missingText) } else { $line2 += [string]$ui.complete }
        if ($r.excessText) { $line2 += ([string]$ui.excess + ': ' + $r.excessText) }
        $sep = '  ' + [char]0xB7 + '  '   # middle dot; keep this file ASCII-only
        $y += (New-Label $f ($line2 -join $sep) $pad $y ($W - 2 * $pad) $script:FontSmall $script:Muted).Height + 1
        if ($r.tip) { $y += (New-Label $f ([string]$ui.tip + ': ' + $r.tip) $pad $y ($W - 2 * $pad) $script:FontSmall $script:Muted).Height + 6 } else { $y += 6 }

        $btnW = 128; $boxX = $pad + $btnW + 10; $boxW = $W - $pad - $boxX
        foreach ($v in $r.versions) {
            $b = New-Object System.Windows.Forms.Button
            $b.Text = [string]$v.label
            if ($v.id -eq $r.rec) { $b.Text = $b.Text + "`n(" + [string]$ui.recommended + ")"; $b.BackColor = $script:Accent } else { $b.BackColor = $script:BgBtn }
            $b.FlatStyle = 'Flat'; $b.FlatAppearance.BorderSize = 0; $b.ForeColor = [System.Drawing.Color]::White; $b.Font = $script:FontBtn
            $b.Location = New-Object System.Drawing.Point($pad, $y); $b.Size = New-Object System.Drawing.Size($btnW, 46)
            $b.Tag = $v.id; $b.Cursor = [System.Windows.Forms.Cursors]::Hand; $b.TabStop = $false
            $b.add_Click({ param($s, $e) Choose-Version ([string]$s.Tag) })
            $f.Controls.Add($b)

            $tb = New-Object System.Windows.Forms.TextBox
            $tb.Multiline = $true; $tb.ReadOnly = $true; $tb.WordWrap = $true; $tb.BorderStyle = 'FixedSingle'
            $tb.BackColor = $script:BgBox; $tb.ForeColor = [System.Drawing.Color]::White; $tb.Font = $script:FontBase
            $tb.Text = ([string]$v.text) -replace "`r?`n", "`r`n"
            $h = (Measure-Height ([string]$v.text) $script:FontBase ($boxW - 12)) + 12
            if ($h -gt 150) { $h = 150; $tb.ScrollBars = 'Vertical' }
            if ($h -lt 46) { $h = 46 }
            $tb.Location = New-Object System.Drawing.Point($boxX, $y); $tb.Size = New-Object System.Drawing.Size($boxW, $h)
            $tb.Tag = $v.id; $tb.Cursor = [System.Windows.Forms.Cursors]::Hand; $tb.TabStop = $false
            $tb.add_Click({ param($s, $e) Choose-Version ([string]$s.Tag) })
            $f.Controls.Add($tb)
            $script:Boxes[[string]$v.id] = $tb
            $y += [Math]::Max(46, $h) + 8
        }

        $y += 2
        $cb = New-Object System.Windows.Forms.CheckBox
        $cb.Text = [string]$ui.paste; $cb.Checked = [bool]$script:Tray.paste; $cb.AutoSize = $true; $cb.Font = $script:FontSmall; $cb.ForeColor = $script:Muted
        $cb.Location = New-Object System.Drawing.Point($pad, $y); $cb.TabStop = $false
        $cb.add_CheckedChanged({ param($s, $e) $script:Tray.paste = [bool]$s.Checked; $script:MiPaste.Checked = $script:Tray.paste; Save-TrayConfig })
        $f.Controls.Add($cb)

        $pb = New-Object System.Windows.Forms.Button
        $pb.Text = [string]$ui.pro; $pb.FlatStyle = 'Flat'; $pb.FlatAppearance.BorderSize = 0; $pb.BackColor = $script:BgBtn; $pb.ForeColor = [System.Drawing.Color]::White; $pb.Font = $script:FontSmall
        $pb.Size = New-Object System.Drawing.Size(110, 24); $pb.Location = New-Object System.Drawing.Point(($W - $pad - 110), ($y - 2)); $pb.TabStop = $false
        $pb.add_Click({ Start-ProRewrite })
        $f.Controls.Add($pb)
        $script:ProBtn = $pb
        $y += 26

        $script:Status = New-Label $f ([string]$ui.hint) $pad $y ($W - 2 * $pad) $script:FontSmall $script:Muted
        $y += $script:Status.Height
    }

    $f.Height = $y + $pad
    $pos = $cap.Cursor
    $wa = [System.Windows.Forms.Screen]::FromPoint($pos).WorkingArea
    $x = [Math]::Max($wa.Left, [Math]::Min($pos.X + 12, $wa.Right - $f.Width))
    $yy = [Math]::Max($wa.Top, [Math]::Min($pos.Y + 12, $wa.Bottom - $f.Height))
    $f.Location = New-Object System.Drawing.Point($x, $yy)

    $f.add_KeyDown({ param($s, $e)
        if ($e.KeyCode -eq 'Escape') { $e.Handled = $true; Close-Popup; return }
        if ($e.KeyCode -in 'A', 'B', 'C') { $e.Handled = $true; $e.SuppressKeyPress = $true; Choose-Version ([string]$e.KeyCode) }
    })
    $f.add_Deactivate({ if (-not $script:ProProc) { Close-Popup } })
    $f.add_FormClosed({ $script:Popup = $null; $script:Status = $null; $script:ProBtn = $null })
    $f.Show()
    $f.Activate()
    if ($r.ok -and $script:Tray.llm) { Start-ProRewrite }
    Write-Log ("popup shown: ok=" + $r.ok + " score=" + $r.score + " type=" + $r.type + " lang=" + $r.lang + " origin=" + $cap.Origin + " source='" + $cap.Title + "'")
}

# ---- Hotkey handler ----------------------------------------------------------
function On-Hotkey {
    if ($script:Busy) { return }
    $script:Busy = $true
    try {
        if ($script:Popup -and -not $script:Popup.IsDisposed) { Close-Popup; return }
        $cap = Get-SelectionText
        Write-Log ("hotkey: " + $cap.Origin + ", " + ([string]$cap.Text).Length + " chars from '" + $cap.Title + "'")
        $req = @{ text = [string]$cap.Text; source = [string]$cap.Title; origin = $cap.Origin }
        $reqPath = Join-Path $script:TmpDir 'req.json'
        Write-Json $reqPath $req
        $res = Invoke-CoreJson @('--req', $reqPath) 30000
        if (-not $res) { $script:Notify.ShowBalloonTip(4000, 'PromptGate', [string]$script:UI.engineFail, [System.Windows.Forms.ToolTipIcon]::Error); return }
        Show-Popup $res $cap
    } catch {
        Write-Log "hotkey handler error: $_"
    } finally { $script:Busy = $false }
}

# ---- Boot: node, config, UI strings ------------------------------------------
$script:NodeExe = Find-Node
if (-not $script:NodeExe) {
    Write-Log 'node.exe not found'
    [System.Windows.Forms.MessageBox]::Show('PromptGate: node.exe not found. Install Node.js 18+ (https://nodejs.org) or set "tray": { "node": "C:\\path\\node.exe" } in ' + $script:ConfigFile, 'PromptGate') | Out-Null
    exit 1
}
$cfgRes = Invoke-CoreJson @('--config') 20000
if (-not $cfgRes -or -not $cfgRes.ok) {
    [System.Windows.Forms.MessageBox]::Show('PromptGate: the engine did not start. See ' + $script:LogFile, 'PromptGate') | Out-Null
    exit 1
}
$script:Tray = @{}
foreach ($p in $cfgRes.tray.PSObject.Properties) { $script:Tray[$p.Name] = $p.Value }
$script:Reports = [string]$cfgRes.reports
$uiLang = if ($script:Tray.language -eq 'en') { 'en' } else { 'vi' }
$script:UI = Invoke-CoreJson @('--ui', $uiLang) 20000
if (-not $script:UI) { [System.Windows.Forms.MessageBox]::Show('PromptGate: could not load UI strings. See ' + $script:LogFile, 'PromptGate') | Out-Null; exit 1 }
Write-Log ("start: node=" + $script:NodeExe + " hotkey=" + $script:Tray.hotkey + " lang=" + $uiLang + " pro=" + $cfgRes.pro)

# ---- Tray icon + menu --------------------------------------------------------
function New-TrayIcon([bool]$on) {
    $bmp = New-Object System.Drawing.Bitmap 16, 16
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'
    $g.Clear([System.Drawing.Color]::Transparent)
    $fill = if ($on) { $script:Accent } else { [System.Drawing.Color]::FromArgb(120, 122, 130) }
    $g.FillEllipse((New-Object System.Drawing.SolidBrush($fill)), 0, 0, 15, 15)
    $g.DrawString('P', (New-Object System.Drawing.Font('Segoe UI', 8.5, [System.Drawing.FontStyle]::Bold)), [System.Drawing.Brushes]::White, 2.6, 0.2)
    $g.Dispose()
    return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}
$script:IconOn = New-TrayIcon $true
$script:IconOff = New-TrayIcon $false

$script:Notify = New-Object System.Windows.Forms.NotifyIcon
$script:Notify.Visible = $true
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$script:MiEnable  = $menu.Items.Add([string]$script:UI.menu.enable)
$script:MiHotkey  = $menu.Items.Add([string]$script:UI.menu.hotkey)
$script:MiPaste   = $menu.Items.Add([string]$script:UI.menu.paste)
$script:MiLlm     = $menu.Items.Add([string]$script:UI.menu.llm)
[void]$menu.Items.Add('-')
$script:MiHistory = $menu.Items.Add([string]$script:UI.menu.history)
$script:MiLog     = $menu.Items.Add([string]$script:UI.menu.log)
$script:MiStartup = $menu.Items.Add([string]$script:UI.menu.startup)
[void]$menu.Items.Add('-')
$script:MiQuit    = $menu.Items.Add([string]$script:UI.menu.quit)
$script:Notify.ContextMenuStrip = $menu

function Update-TrayState {
    $on = [bool]$script:Tray.enabled
    $script:MiEnable.Checked = $on
    $script:MiPaste.Checked = [bool]$script:Tray.paste
    $script:MiLlm.Checked = [bool]$script:Tray.llm
    $script:MiHotkey.Text = [string]$script:UI.menu.hotkey + '  (' + $script:Tray.hotkey + ')'
    $script:Notify.Icon = if ($on) { $script:IconOn } else { $script:IconOff }
    $text = if ($on) { ([string]$script:UI.trayOn -f $script:Tray.hotkey) } else { [string]$script:UI.trayOff }
    if ($text.Length -gt 63) { $text = $text.Substring(0, 63) }
    $script:Notify.Text = $text
}

$script:MiEnable.add_Click({
    $script:Tray.enabled = -not [bool]$script:Tray.enabled
    if ($script:Tray.enabled) { if (-not (Register-Hotkey)) { $script:Notify.ShowBalloonTip(5000, 'PromptGate', ([string]$script:UI.hotkeyFail -f $script:Tray.hotkey), [System.Windows.Forms.ToolTipIcon]::Warning) } }
    else { $script:HotWin.Unregister(); Write-Log 'hotkey unregistered (disabled)' }
    Save-TrayConfig; Update-TrayState
})
$script:MiPaste.add_Click({ $script:Tray.paste = -not [bool]$script:Tray.paste; Save-TrayConfig; Update-TrayState })
$script:MiLlm.add_Click({ $script:Tray.llm = -not [bool]$script:Tray.llm; Save-TrayConfig; Update-TrayState })
$script:MiLog.add_Click({ Start-Process explorer.exe $script:DataDir })
$script:MiHistory.add_Click({
    try {
        [System.Windows.Forms.Cursor]::Current = [System.Windows.Forms.Cursors]::WaitCursor
        Invoke-Node $script:HistoryJs @('30') 120000 | Out-Null
        $latest = Get-ChildItem -Path $script:Reports -Filter 'history-*.md' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($latest) { Start-Process $latest.FullName } else { Start-Process explorer.exe $script:DataDir }
    } catch { Write-Log "history failed: $_" } finally { [System.Windows.Forms.Cursor]::Current = [System.Windows.Forms.Cursors]::Default }
})

# Startup shortcut (per-user Startup folder -> Start-Hidden.vbs)
$script:LnkPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'PromptGate.lnk'
$script:MiStartup.Checked = (Test-Path $script:LnkPath)
$script:MiStartup.add_Click({
    if (Test-Path $script:LnkPath) { Remove-Item $script:LnkPath -Force -ErrorAction SilentlyContinue; $script:MiStartup.Checked = $false; Write-Log 'startup shortcut removed' }
    else {
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut($script:LnkPath)
        $sc.TargetPath = (Join-Path $script:ScriptDir 'Start-Hidden.vbs')
        $sc.WorkingDirectory = $script:ScriptDir
        $sc.Description = 'PromptGate tray'
        $sc.Save()
        $script:MiStartup.Checked = $true; Write-Log 'startup shortcut created'
    }
})

# Hotkey change dialog: press the new combination, Save.
function Build-Combo($e) {
    $k = $e.KeyCode
    if ($k -in 'ControlKey', 'Menu', 'ShiftKey', 'LWin', 'RWin', 'None') { return $null }
    $parts = @()
    if ($e.Control) { $parts += 'Ctrl' }
    if ($e.Alt) { $parts += 'Alt' }
    if ($e.Shift) { $parts += 'Shift' }
    if ($parts.Count -eq 0) { return $null }
    $name = $k.ToString()
    if ($name -match '^D(\d)$') { $name = $matches[1] }
    return (($parts + $name) -join '+')
}
$script:MiHotkey.add_Click({
    $d = New-Object System.Windows.Forms.Form
    $d.Text = [string]$script:UI.hotkeyTitle; $d.FormBorderStyle = 'FixedDialog'; $d.StartPosition = 'CenterScreen'; $d.TopMost = $true
    $d.MinimizeBox = $false; $d.MaximizeBox = $false; $d.ClientSize = New-Object System.Drawing.Size(400, 150); $d.Font = $script:FontBase
    $l = New-Object System.Windows.Forms.Label; $l.Text = [string]$script:UI.hotkeyPrompt; $l.AutoSize = $false; $l.Location = New-Object System.Drawing.Point(14, 12); $l.Size = New-Object System.Drawing.Size(372, 40); $d.Controls.Add($l)
    $tb = New-Object System.Windows.Forms.TextBox; $tb.ReadOnly = $true; $tb.Text = [string]$script:Tray.hotkey; $tb.Font = New-Object System.Drawing.Font('Segoe UI', 13, [System.Drawing.FontStyle]::Bold)
    $tb.Location = New-Object System.Drawing.Point(14, 56); $tb.Size = New-Object System.Drawing.Size(372, 32); $tb.TextAlign = 'Center'; $d.Controls.Add($tb)
    $tb.add_KeyDown({ param($s, $e) $e.SuppressKeyPress = $true; $e.Handled = $true; $c = Build-Combo $e; if ($c) { $s.Text = $c } })
    $ok = New-Object System.Windows.Forms.Button; $ok.Text = [string]$script:UI.save; $ok.DialogResult = 'OK'; $ok.Location = New-Object System.Drawing.Point(206, 104); $ok.Size = New-Object System.Drawing.Size(86, 30); $d.Controls.Add($ok)
    $no = New-Object System.Windows.Forms.Button; $no.Text = [string]$script:UI.cancel; $no.DialogResult = 'Cancel'; $no.Location = New-Object System.Drawing.Point(300, 104); $no.Size = New-Object System.Drawing.Size(86, 30); $d.Controls.Add($no)
    $d.AcceptButton = $ok; $d.CancelButton = $no
    $script:HotWin.Unregister()
    $r = $d.ShowDialog()
    $old = $script:Tray.hotkey
    if ($r -eq 'OK' -and $tb.Text) { $script:Tray.hotkey = $tb.Text }
    if ($script:Tray.enabled) {
        if (-not (Register-Hotkey)) {
            [System.Windows.Forms.MessageBox]::Show(([string]$script:UI.hotkeyFail -f $script:Tray.hotkey), 'PromptGate') | Out-Null
            $script:Tray.hotkey = $old; Register-Hotkey | Out-Null
        }
    }
    Save-TrayConfig; Update-TrayState
    $d.Dispose()
})

$script:MiQuit.add_Click({
    try { $script:HotWin.Unregister() } catch {}
    Close-Popup
    $script:Notify.Visible = $false; $script:Notify.Dispose()
    Write-Log 'quit'
    [System.Windows.Forms.Application]::Exit()
})

# ---- Timers, hotkey window, go -----------------------------------------------
$script:CloseTimer = New-Object System.Windows.Forms.Timer; $script:CloseTimer.Interval = 900
$script:CloseTimer.add_Tick({ $script:CloseTimer.Stop(); Close-Popup })
$script:ProTimer = New-Object System.Windows.Forms.Timer; $script:ProTimer.Interval = 250
$script:ProTimer.add_Tick({ try { Finish-ProRewrite } catch { Write-Log "pro poll error: $_" } })

$script:HotWin = New-Object PgHotkeyWindow
$script:HotWin.add_Pressed({ On-Hotkey })
$script:Busy = $false
$script:Popup = $null
$script:Target = [IntPtr]::Zero

Update-TrayState
if ($script:Tray.enabled) {
    if (Register-Hotkey) { $script:Notify.ShowBalloonTip(3000, 'PromptGate', ([string]$script:UI.started -f $script:Tray.hotkey), [System.Windows.Forms.ToolTipIcon]::Info) }
    else { $script:Notify.ShowBalloonTip(6000, 'PromptGate', ([string]$script:UI.hotkeyFail -f $script:Tray.hotkey), [System.Windows.Forms.ToolTipIcon]::Warning) }
}
[System.Windows.Forms.Application]::Run()
