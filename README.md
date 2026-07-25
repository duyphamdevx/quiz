# Bộ Đề — ứng dụng luyện quiz chạy trên GitHub Pages

Ứng dụng tĩnh (HTML/CSS/JS thuần, không cần build, không cần backend). Mượt kể cả với vài nghìn câu hỏi vì tại một thời điểm chỉ có **đúng 1 câu hỏi** được vẽ ra màn hình.

## Tính năng chính

- **Nhiều môn học**: thêm bao nhiêu môn tuỳ ý (mỗi môn là một file JSON). Mỗi môn lưu tiến trình và ghi chú **riêng biệt**, không ảnh hưởng lẫn nhau.
- **Học theo vòng, lặp đến khi đúng hết**: vòng 1 làm hết các câu đã chọn; câu nào sai, vòng 2 sẽ chỉ hỏi lại đúng những câu đó; cứ thế đến khi một vòng không còn câu sai nào — coi như đã thuộc bộ đó. Điểm cuối cùng hiển thị là điểm **lần làm đầu tiên** (vòng 1) và số vòng cần để thuộc hết.
- **Giải thích tự lưu**: sau khi trả lời mỗi câu, có nút "+ Thêm giải thích" — gõ ghi chú của riêng bạn, bấm Lưu. Ghi chú này lưu vào trình duyệt và sẽ hiện lại y nguyên ở những lần học sau, kể cả sau khi tắt trình duyệt.
- Tự lưu phiên đang học dở (kể cả đang ở giữa vòng) — quay lại là có nút "Tiếp tục phiên trước" hoặc "Đang học dở — vòng X" ngay trên thẻ môn học.
- Bấm phím số (1, 2, 3…) để chọn đáp án, Enter để qua câu tiếp theo.
- **Thống kê câu hay sai (luỹ kế)**: mỗi môn có nút "Xem thống kê câu hay sai" — liệt kê các câu bạn từng làm sai, xếp theo số lần sai nhiều nhất, tính gộp qua **mọi lần học** chứ không chỉ phiên hiện tại.
- **Thanh động lực**: trên màn hình danh sách môn, hiện số ngày học liên tiếp (streak), độ chính xác chung và tổng số câu đã học luỹ kế trên toàn bộ các môn.
- **Xuất / nhập dữ liệu**: nút "Xuất dữ liệu" tải về 1 file JSON chứa toàn bộ môn học, tiến trình, ghi chú, thống kê — dùng để sao lưu hoặc chuyển sang máy khác. Nút "Nhập dữ liệu" đọc lại file đó (sẽ ghi đè dữ liệu hiện có trên trình duyệt).
- **Chế độ thi thử giới hạn giờ**: ở màn hình cấu hình, chọn "Kiểu học" = "Thi thử", chọn số câu và thời gian (phút). Làm hết câu hoặc hết giờ là nộp bài tự động. App tự ưu tiên chọn những câu **chưa** xuất hiện ở lần thi thử gần nhất trong cùng môn — nghĩa là tối đa 20% câu có thể trùng với lần thi trước (chỉ trùng khi bộ đề không còn đủ câu mới).

## 1. Đưa lên GitHub Pages

1. Tạo một repo mới trên GitHub, ví dụ `quiz-app`.
2. Đưa 4 file này vào repo: `index.html`, `style.css`, `script.js`, `questions.json`.
3. Vào **Settings → Pages** → **Build and deployment** → Source chọn **Deploy from a branch** → Branch `main`, thư mục `/ (root)` → Save.
4. Sau khoảng 1 phút, trang chạy tại `https://<tên-github-của-bạn>.github.io/quiz-app/`.

Thử trước ở máy mình (không mở file `index.html` trực tiếp bằng double-click vì `fetch` sẽ không đọc được `questions.json` qua `file://`):

```bash
python3 -m http.server 8000
```
rồi mở `http://localhost:8000`.

## 2. Thêm môn học mới

Ở màn hình đầu, bấm **"+ Thêm môn học mới"**, chọn file `.json` đúng định dạng bên dưới. App sẽ hỏi tên môn (ví dụ "Toán 10", "Tiếng Anh - Unit 5"...) rồi lưu thành một môn riêng trong danh sách — không cần deploy lại, không ghi đè môn đã có.

Định dạng mỗi câu hỏi trong file JSON:

```json
{
  "id": 26,
  "category": "Chương 1",
  "question": "Nội dung câu hỏi?",
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
  "answer": 1,
  "explanation": "Giải thích mặc định (không bắt buộc)"
}
```

- `answer` là **chỉ số** (bắt đầu từ 0) của đáp án đúng trong mảng `options`.
- `category` dùng làm "chương/chủ đề" để lọc trong một môn — đặt tên tuỳ ý.
- `explanation` không bắt buộc — nếu có sẽ là giải thích mặc định hiển thị sau khi trả lời; bạn vẫn có thể bấm "Sửa" để viết đè ghi chú của riêng mình, ghi chú này được ưu tiên hiển thị từ đó về sau.
- Thêm được vài trăm đến vài nghìn câu trong một file, không giật lag.

`questions.json` đi kèm chỉ là một bộ mẫu để bạn xem định dạng — lần chạy đầu tiên nó sẽ tự được thêm vào danh sách môn học với tên "Bộ mẫu".

## 3. Lưu trữ hoạt động thế nào

Toàn bộ dữ liệu (danh sách môn, câu hỏi từng môn, ghi chú, phiên đang học dở) lưu trong `localStorage` của trình duyệt — **chỉ trên máy/trình duyệt bạn đang dùng**, không đồng bộ giữa các thiết bị, không gửi lên đâu cả. Xoá một môn ở danh sách sẽ xoá luôn ghi chú và tiến trình của môn đó.

## Cấu trúc file

```
index.html     — khung giao diện (danh sách môn, cấu hình, quiz, kết quả)
style.css      — giao diện
script.js      — toàn bộ logic: môn học, vòng lặp ôn câu sai, ghi chú, lưu tiến trình
questions.json — bộ câu hỏi mẫu, chỉ dùng để minh hoạ định dạng
```
