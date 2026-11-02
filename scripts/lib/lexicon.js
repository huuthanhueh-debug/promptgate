'use strict';
// PromptGate shared lexicon (VI + EN). Pure data, no logic.
// Principles distilled from public prompt-engineering guidance (Anthropic, OpenAI, Google)
// and the CO-STAR / RTF / CRISPE families: clear goal, grounded context, explicit output,
// constraints, acceptance criteria, economy, and depth matched to task size.

const VI_CHARS = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i;
const VI_WORDS = /\b(và|của|cho|tôi|không|làm|với|này|được|các|một|có|là|để|giúp|hãy|cần)\b/i;

// Things the gate never touches.
const ACK = /^(ok(ay)?|oke|yes|yep|no|nope|y|n|sure|thanks?|thank you|thx|cảm ơn|cám ơn|tiếp( đi| tục)?|continue|go( ahead)?|proceed|next|làm đi|làm tiếp|đồng ý|được|ừ|uh|um|dạ|vâng|rồi|xong|done|stop|dừng|hủy|cancel|good|great|nice|tốt|hay|đúng( rồi)?|correct|approve[d]?|lgtm|skip|bỏ qua|không cần|ko cần|k cần)[.!…]*$/i;
const AUTOMATED = /^\s*<(side-sessions-event|task-notification|ci-monitor-event|system-reminder|agent-message|command-name|command-message|local-command|scheduled-task|automated|bash-input|bash-stdout)/i;
const AUTOMATED_TEXT = /(automated run of a scheduled task|\[Subagent hand-back\]|SYSTEM NOTIFICATION - NOT USER INPUT)/i;

// Action verbs (goal clarity).
const VERBS = {
  vi: ['tạo', 'xây', 'xây dựng', 'viết', 'soạn', 'sửa', 'chỉnh', 'thêm', 'xóa', 'bỏ', 'đổi', 'thay', 'cập nhật', 'nâng cấp', 'tối ưu', 'phân tích', 'so sánh', 'đánh giá', 'kiểm tra', 'review', 'tóm tắt', 'dịch', 'giải thích', 'liệt kê', 'lập', 'thiết kế', 'triển khai', 'cài', 'cấu hình', 'chạy', 'test', 'debug', 'tìm', 'trích', 'xuất', 'nhập', 'gộp', 'tách', 'chuyển', 'refactor', 'deploy', 'đẩy', 'commit', 'tính', 'đề xuất', 'lên kế hoạch', 'rà soát', 'mô tả', 'vẽ', 'làm', 'render', 'duyệt', 'gửi', 'mở', 'đọc', 'in', 'tải', 'lưu', 'sao chép', 'hạ', 'tăng', 'giảm', 'bật', 'tắt', 'đặt', 'kết nối', 'đồng bộ', 'push', 'pull', 'publish', 'đăng'],
  en: ['create', 'build', 'write', 'draft', 'fix', 'change', 'add', 'remove', 'delete', 'update', 'upgrade', 'optimize', 'analyze', 'analyse', 'compare', 'evaluate', 'assess', 'check', 'review', 'summarize', 'summarise', 'translate', 'explain', 'list', 'design', 'implement', 'install', 'configure', 'run', 'test', 'debug', 'find', 'extract', 'export', 'import', 'merge', 'split', 'convert', 'refactor', 'deploy', 'push', 'commit', 'calculate', 'compute', 'propose', 'plan', 'audit', 'describe', 'generate', 'rewrite', 'migrate', 'document', 'make', 'do', 'improve', 'help', 'show', 'tell', 'give', 'render', 'approve', 'send', 'open', 'read', 'print', 'download', 'save', 'copy', 'lower', 'raise', 'increase', 'decrease', 'enable', 'disable', 'set', 'connect', 'sync', 'pull', 'publish', 'post', 'redeploy', 'restart', 'rerun', 're-run'],
};

// Vague verbs: acceptable only when the object is specific.
const VAGUE_VERBS = /\b(làm|xem|giúp|sửa lại|làm lại|cải thiện|tốt hơn|hay hơn|đẹp hơn|chỉnh lại|help|fix it|fix this|improve|make it better|better|do it|do this|do that|handle|deal with|look at|take care)\b/gi;
// Vague referents.
const VAGUE_REFS = /\b(cái này|cái đó|cái kia|chỗ này|chỗ đó|nó|này|đó|việc này|phần này|mấy cái|this|that|these|those|it|stuff|things?|something|the thing|the issue|the problem|the code|the file|the app)\b/gi;

// Question openers.
const QUESTION = /^(tại sao|vì sao|sao|như thế nào|thế nào|là gì|có nên|có phải|có thể|bao nhiêu|khi nào|ở đâu|ai|cái gì|liệu|what|why|how|when|where|who|which|is|are|can|could|should|would|does|do|did|will)\b/i;

// Concrete reference detectors (context grounding).
const REFS = {
  path: /(?:[A-Za-z]:\\|\.{0,2}[\/\\])?[\w.-]+[\/\\][\w.\/\\-]+\.\w{1,6}\b|\b[\w-]+\.(?:js|ts|tsx|jsx|py|json|md|sql|html|css|yml|yaml|xlsx|docx|pdf|csv|env|toml|sh|ps1|java|go|rs|php|vue|svelte)\b/g,
  url: /https?:\/\/\S+/g,
  code: /`[^`]+`|\b[a-z]+[A-Z]\w+\b|\b\w+_\w+\(?\b|\b[A-Z][a-z]+(?:[A-Z][a-z]+)+\b/g,
  error: /\b(error|exception|traceback|stack ?trace|undefined is not|cannot read|ENOENT|ECONN\w*|TypeError|ReferenceError|SyntaxError|404|500|lỗi:|exit code \d+)\b/gi,
  attached: /<pasted_content|\[Pasted text|@[\w./\\-]+\.\w{1,6}\b|đính kèm|attached|file kèm/gi,
  quoted: /"[^"]{3,}"|'[^']{3,}'|“[^”]{3,}”/g,
  number: /\b\d+(?:[.,]\d+)?\s*(?:%|px|ms|s|m|h|ngày|tuần|tháng|từ|dòng|lines?|words?|rows?|items?|usd|vnd|đ|\$)/gi,
};

const OUTPUT = /\b(bảng|danh sách|liệt kê|json|markdown|md|csv|xlsx|excel|docx|word|pdf|pptx|slide|html|sơ đồ|biểu đồ|ngắn gọn|chi tiết|tóm tắt|dưới \d+|không quá \d+|tối đa \d+|\d+ ?(?:từ|dòng|câu|đoạn|gạch đầu dòng|bullet|mục|trang)|bằng tiếng|song ngữ|định dạng|format|table|list|bullet points?|schema|diagram|chart|outline|template|report|báo cáo|email|tone|giọng|văn phong|in (?:english|vietnamese)|output|đầu ra|trả về|return|save (?:to|as)|lưu (?:vào|thành|ra)|xuất ra|viết vào|ghi vào|file (?:mới|riêng)|one[- ]liner|một dòng|step[- ]by[- ]step|từng bước|diff|patch|snippet|code block|only the (?:diff|changes?|code|answer|result)|chỉ (?:diff|phần thay đổi|code|kết quả)|giải thích|explanation|explain why|summary|tóm lược)\b/gi;

const CONSTRAINT = /\b(không được|đừng|tuyệt đối không|phải|bắt buộc|chỉ|giữ nguyên|không đổi|không thay đổi|không xóa|tránh|hạn chế|ưu tiên|trừ|ngoại trừ|tối đa|tối thiểu|ít nhất|nhiều nhất|trong vòng|deadline|trước \d|must|mustn't|must not|do not|don't|never|only|keep|preserve|avoid|without|except|at most|at least|no more than|limit|max(?:imum)?|min(?:imum)?|within|constraint|ràng buộc|điều kiện|yêu cầu bắt buộc|backward.compatible|tương thích ngược|không phá|không break|read[- ]only|chỉ đọc)\b/gi;

const ACCEPTANCE = /\b(hoàn thành khi|xong khi|coi là xong|đạt khi|thành công khi|test (?:pass|xanh|chạy)|pass(?:es|ed)? (?:all )?tests?|all tests|tests? (?:pass|green)|chạy được|chạy không lỗi|không còn lỗi|xác nhận|verify|verified|kiểm tra lại|double[- ]check|acceptance|tiêu chí|criteria|definition of done|done when|expected (?:result|output|behavior)|kết quả mong đợi|should (?:return|show|display|produce)|phải (?:ra|hiện|trả về)|so sánh trước.sau|before.after|screenshot|chụp màn hình|demo|chứng minh|proof|báo cáo lại|report back)\b/gi;

const DEPTH_CUE = /\b(ultrathink|think (?:hard|harder|deeply|step by step)|suy nghĩ (?:kỹ|sâu|thật kỹ)|nghĩ kỹ|lập kế hoạch|plan (?:first|before)|kế hoạch trước|từng bước|step[- ]by[- ]step|tự kiểm tra|self[- ]check|verify|review lại|rà soát|hết công suất|kỹ lưỡng|thoroughly|thorough|cẩn thận|carefully|đừng dừng|không dừng|don't stop|do not stop|làm hết|làm trọn|complete(?:ly)? everything|end[- ]to[- ]end|toàn diện|comprehensive|exhaustive|deep dive|phân tích sâu)\b/gi;

const FAST_CUE = /\b(nhanh|fast|quick(?:ly)?|ngắn gọn thôi|đơn giản thôi|sơ bộ|rough|briefly|tl;?dr|one[- ]liner)\b/i;
const MAX_CUE = /\b(ultrathink|max|hết công suất|kỹ nhất|tối đa công suất|full power|go all out)\b/i;

// Filler / politeness that costs tokens and adds nothing.
const FILLER = [
  /\b(làm ơn|vui lòng|xin vui lòng|xin hãy|giúp (?:tôi|mình|em|anh|chị) với|giúp (?:tôi|mình) nhé|bạn có thể|bạn ơi|claude ơi|cho (?:tôi|mình) hỏi|mình muốn hỏi|tôi muốn hỏi|cho (?:tôi|mình) nhờ|nhờ bạn|phiền bạn|xin lỗi(?: làm phiền)?|cảm ơn (?:bạn|nhiều|trước)|cám ơn|rất mong|hy vọng bạn)\b/gi,
  /\b(please|pls|plz|kindly|could you(?: please)?|can you(?: please)?|would you(?: mind)?|i was wondering(?: if)?|i would like you to|i'd like you to|i want you to|if (?:you (?:don't mind|can)|possible)|thank you(?: so much| in advance)?|thanks(?: a lot| in advance)?|sorry (?:to bother|for)|hey claude|hi claude|hello claude|you are (?:a|an) (?:expert|senior|world[- ]class)[^.,\n]*)\b/gi,
  /\b(nhé|nha|nhá|ạ|với ạ|đi ạ|hen)\b(?=\s*(?:[,.!?;]|$))/gi,
];

// Leading / trailing politeness removed from the rewrite only (not counted against economy).
const LEAD_FILLER = [
  /^\s*(?:hãy giúp (?:tôi|mình|em)|giúp (?:tôi|mình|em|anh|chị)(?: với)?|hãy|xin|nhờ bạn|bạn|mình nhờ|tôi nhờ|tôi muốn bạn|tôi cần bạn|help me(?: to)?|i need you to|i need help (?:to|with)|i want to|i'd like to|i would like to|let's|lets)\s+/iu,
  /\s+(?:với|giùm|giúp|dùm|hộ|nhé|nha|nhá|ạ|đi)(?=[\s.,!?]*$)/iu,
];

const STOPWORDS = new Set(['và', 'của', 'cho', 'tôi', 'không', 'làm', 'với', 'này', 'được', 'các', 'một', 'có', 'là', 'để', 'the', 'a', 'an', 'to', 'of', 'and', 'in', 'on', 'for', 'is', 'it', 'that', 'this', 'with', 'as', 'be', 'or', 'at', 'by', 'từ', 'theo', 'trong', 'ra', 'vào', 'thì', 'mà', 'nếu', 'khi', 'đã', 'sẽ', 'đang', 'cũng', 'rất', 'nhiều', 'ở', 'về', 'như', 'hơn', 'bị', 'lên', 'xuống']);

module.exports = { VI_CHARS, VI_WORDS, ACK, AUTOMATED, AUTOMATED_TEXT, VERBS, VAGUE_VERBS, VAGUE_REFS, QUESTION, REFS, OUTPUT, CONSTRAINT, ACCEPTANCE, DEPTH_CUE, FAST_CUE, MAX_CUE, FILLER, LEAD_FILLER, STOPWORDS };