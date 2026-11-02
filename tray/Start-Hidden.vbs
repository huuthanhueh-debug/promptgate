' PromptGate tray: start with no console window. Used by PromptGate.cmd and the Startup shortcut.
Set sh = CreateObject("WScript.Shell")
scriptDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
ps1 = scriptDir & "\PromptGate.ps1"
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File """ & ps1 & """", 0, False
