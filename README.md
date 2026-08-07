# Bộ Đề — ứng dụng luyện quiz chạy trên GitHub Pages

Ứng dụng tĩnh (HTML/CSS/JS thuần, không cần build, không cần backend). Mượt kể cả với vài nghìn câu hỏi vì tại một thời điểm chỉ có **đúng 1 câu hỏi** được vẽ ra màn hình.

## 1. Đưa lên GitHub Pages

1. Tạo một repo mới trên GitHub, ví dụ `quiz-app`.
2. Đưa các file này vào repo: `index.html`, `style.css`, `script.js`, `questions.json`.
3. Vào **Settings → Pages** → **Build and deployment** → Source chọn **Deploy from a branch** → Branch `main`, thư mục `/ (root)` → Save.
4. Sau khoảng 1 phút, trang chạy tại `https://<tên-github-của-bạn>.github.io/quiz-app/`.

Thử trước ở máy mình (không mở file `index.html` bằng double-click vì `fetch` không đọc được `questions.json` qua `file://`):
```bash
python3 -m http.server 8000
```
rồi mở `http://localhost:8000`.

## 2. Viết công thức toán trong câu hỏi

App đã tích hợp sẵn **KaTeX** để hiển thị công thức toán (phân số, luỹ thừa, căn, tích phân...). Trong file JSON, bọc công thức bằng `\\(` `\\)` (công thức trên dòng) hoặc `$$` `$$` (công thức riêng một dòng lớn), viết theo cú pháp LaTeX:

```json
{
  "id": 1,
  "category": "Giải tích",
  "question": "Xét bài toán tối ưu \\(f(x,y) = -\\frac{1}{3}x^3 + x - \\frac{1}{3}y^3 + y\\). Điểm nào không là điểm dừng?",
  "options": ["(1, 1)", "(1, -1)", "(-1, 1)", "(-1, -1)"],
  "answer": 3
}
```

Vài ký hiệu LaTeX hay dùng:
- Phân số: `\frac{tử}{mẫu}` → \(\frac{1}{3}\)
- Luỹ thừa / chỉ số dưới: `x^3`, `x_1`
- Căn: `\sqrt{x}`, `\sqrt[3]{x}`
- Ký hiệu Hy Lạp: `\alpha`, `\beta`, `\pi`
- Đạo hàm riêng: `\frac{\partial f}{\partial x}`
- Vô cực, tổng, tích phân: `\infty`, `\sum_{i=1}^{n}`, `\int_{a}^{b}`

Lưu ý khi gõ trong JSON: mỗi dấu `\` trong LaTeX phải gõ thành `\\` (hai dấu gạch chéo) vì JSON dùng `\` làm ký tự thoát — ví dụ `\frac` viết thành `\\frac`. Công thức trong `options` và trong `explanation` cũng render được tương tự.

Khi thêm/sửa câu hỏi thủ công trong app (mục 4), mỗi ô — câu hỏi, từng đáp án, giải thích — đều có **khung xem trước công thức ngay bên dưới**, cập nhật theo thời gian thực khi gõ, để kiểm tra công thức hiển thị đúng trước khi lưu.

## 3. Tính năng chính

- **Nhiều môn học** — mỗi môn một file JSON riêng, tiến trình/ghi chú/thống kê tách biệt hoàn toàn.
- **Học theo vòng, lặp đến khi đúng hết** — vòng 1 làm hết các câu đã chọn; câu sai vòng sau chỉ hỏi lại đúng câu đó, lặp đến khi một vòng không còn câu sai. Điểm hiển thị cuối cùng là điểm **lần làm đầu tiên**.
- **Bấm phím số 1, 2, 3… để chọn đáp án**, Enter để qua câu tiếp theo.
- **Giải thích tự lưu theo từng câu** — bấm "+ Thêm giải thích" để ghi chú của riêng bạn, lưu lại vĩnh viễn cho câu đó, có thể sửa lại bất cứ lúc nào.
- **Thi thử giới hạn giờ** — chọn số câu và thời gian (phút), làm bài không thấy đúng/sai ngay (giống thi thật), chỉ chấm điểm khi nộp bài hoặc hết giờ. **Tối đa 20% số câu trong đề trùng với lần thi gần nhất** của cùng môn/chương đó (nếu ngân hàng câu hỏi đủ lớn) — nên mỗi lần thi thử sẽ chủ yếu gặp câu mới, ít bị học tủ.
- **Thống kê câu sai luỹ kế** — bấm "📊 Xem thống kê câu sai" ở màn hình cấu hình môn để xem những câu bạn hay sai nhất tính dồn qua *tất cả* các lần học và thi (không chỉ phiên hiện tại), kèm tỉ lệ sai.
- **Thanh động lực** — chuỗi ngày học liên tiếp, tổng số câu đã ôn, tỉ lệ đúng chung — hiện ngay ở màn hình danh sách môn.
- **Xuất/nhập dữ liệu** — nút "⭱ Xuất dữ liệu" tải về một file JSON chứa toàn bộ môn học, ghi chú, thống kê, lịch sử thi của bạn để backup hoặc chuyển sang máy khác; "⭳ Nhập dữ liệu" nạp lại file đó (môn trùng tên sẽ được thêm bản mới, không ghi đè môn đang có).
- **Dán nhanh câu hỏi từ JSON** — trong màn "Thêm câu hỏi mới", bấm "📋 Dán nhanh từ JSON", dán một object JSON đúng định dạng (`question`, `options`, `answer`...) là app tự điền vào form để bạn xem lại và lưu; dán cả một **mảng** nhiều câu sẽ thêm hàng loạt luôn, không cần review từng câu.
- **Thêm / sửa / xoá câu hỏi thủ công ngay trong app** — nút "✎ Thêm / sửa / xoá câu hỏi thủ công" ở màn hình cấu hình môn, không cần đụng vào file JSON. Sửa nội dung không làm mất ghi chú/thống kê đã có của câu đó (vì id câu hỏi giữ nguyên). Danh sách câu hỏi hiện đầy đủ các đáp án ngay dưới mỗi câu — bấm trực tiếp vào một đáp án để tích nó là đáp án đúng (dấu tròn xanh, kiểu Wayground), không cần mở form sửa; câu nhiều đáp án đúng bấm để bật/tắt từng đáp án (giữ tối thiểu 1 đáp án đúng). Muốn sửa nội dung câu/đáp án (không phải chỉ đổi đáp án đúng) của câu nhiều đáp án đúng thì vẫn cần sửa trực tiếp trong file JSON để tránh vô tình làm mất bớt đáp án đúng.
- **Bật/tắt dừng lại xem giải thích** — trong màn luyện tập có một công tắc ngay dưới câu hỏi ("Dừng lại xem giải thích, chờ Enter mới qua câu"). Bật (mặc định): trả lời xong sẽ dừng lại, hiện giải thích, chờ bạn bấm Enter/nút "Câu tiếp theo" mới qua câu. Tắt: trả lời xong tự động nhảy sang câu tiếp theo ngay, không hiện gì thêm — phù hợp khi muốn luyện nhanh. Lựa chọn này được nhớ lại cho lần sau.
- **Sửa nhanh câu hỏi hiện tại ngay lúc đang làm bài** — trong màn câu hỏi luyện tập, bấm "Sửa câu hỏi hiện tại" ngay dưới câu hỏi để chỉnh nội dung/đáp án/đáp án đúng rồi lưu tại chỗ, không thoát phiên học.
- Tự lưu phiên đang học dở, kể cả đang ở giữa vòng.

## 4. Thêm môn học mới

Có hai cách:

- **Nhập tay hoàn toàn** — bấm "+ Tạo môn học mới (nhập tay)" ở màn hình đầu, đặt tên môn, app sẽ tạo một môn rỗng và đưa thẳng vào màn "Thêm câu hỏi mới" để bạn gõ câu hỏi trực tiếp, không cần file JSON nào cả.
- **Tải file JSON có sẵn** — bấm "+ Thêm môn học mới (tải file JSON)", chọn file `.json` đúng định dạng bên dưới.

Định dạng mỗi câu hỏi trong file JSON:

```json
{
  "id": 26,
  "category": "Chương 1",
  "question": "Nội dung câu hỏi (có thể chứa công thức toán như trên)?",
  "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
  "answer": 1,
  "explanation": "Giải thích mặc định (không bắt buộc)"
}
```

- `answer` là **chỉ số** (bắt đầu từ 0) của đáp án đúng.
- `category` dùng làm "chương/chủ đề" để lọc trong một môn.
- `explanation` không bắt buộc — nếu có, đây là giải thích mặc định; bạn vẫn có thể bấm "Sửa" để viết đè ghi chú riêng, ghi chú riêng sẽ được ưu tiên hiển thị từ đó về sau.

`questions.json` đi kèm là bộ mẫu minh hoạ định dạng, lần chạy đầu tự thêm vào danh sách môn với tên "Bộ mẫu".

## 5. Lưu trữ hoạt động thế nào

Toàn bộ dữ liệu (môn học, câu hỏi, ghi chú, thống kê, lịch sử thi, streak) lưu trong `localStorage` của trình duyệt — chỉ trên máy/trình duyệt bạn đang dùng, không đồng bộ giữa các thiết bị. Dùng nút **Xuất dữ liệu** định kỳ để backup phòng khi xoá cache hoặc đổi máy. Xoá một môn ở danh sách sẽ xoá luôn ghi chú, thống kê và tiến trình của môn đó.

## Cấu trúc file

```
index.html     — khung giao diện (danh sách môn, cấu hình, luyện tập, thi thử, thống kê)
style.css      — giao diện
script.js      — toàn bộ logic: môn học, vòng lặp ôn câu sai, ghi chú, thi thử, thống kê, backup
questions.json — bộ câu hỏi mẫu, minh hoạ định dạng
```
