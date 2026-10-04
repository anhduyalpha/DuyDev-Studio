    def test_stem_with_vitamin_a_dot(self):
        text = (
            "Câu 10. Thiếu Vitamin A. dẫn tới bệnh quáng gà và khô giác mạc:\n"
            "A. Phát biểu đúng\n"
            "B. Phát biểu sai\n"
            "C. Chưa đủ dữ kiện\n"
            "D. Không liên quan"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("Vitamin A.", b["stem"])
        self.assertEqual(b["options"]["A"], "Phát biểu đúng")
        self.assertEqual(b["options"]["B"], "Phát biểu sai")

    def test_stem_with_geometry_vuong_tai_a(self):
        text = (
            "Câu 11. Cho tam giác ABC vuông tại A. Biết cạnh AB = 3, AC = 4. Độ dài cạnh BC là:\n"
            "A. 5\n"
            "B. 6\n"
            "C. 7\n"
            "D. 8"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("vuông tại A.", b["stem"])
        self.assertEqual(b["options"]["A"], "5")
        self.assertEqual(b["options"]["B"], "6")

    def test_stem_with_scientific_name_a_thaliana(self):
        text = (
            "Câu 12. Cây mô hình A. thaliana được sử dụng rộng rãi trong sinh học phân tử thực vật:\n"
            "A. Đúng\n"
            "B. Sai\n"
            "C. Không xác định\n"
            "D. Chưa rõ"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertIn("A. thaliana", b["stem"])
        self.assertEqual(b["options"]["A"], "Đúng")
        self.assertEqual(b["options"]["B"], "Sai")

    def test_option_content_sequential_letters(self):
        text = (
            "Câu 13. Trong không gian Oxyz, chọn mệnh đề đúng:\n"
            "A. Điểm B. nằm trên trục Ox\n"
            "B. Điểm C. nằm trên trục Oy\n"
            "C. Điểm D. nằm trên trục Oz\n"
            "D. Cả 3 điểm trên"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["confidence"], "high")
        self.assertEqual(b["options"]["A"], "Điểm B. nằm trên trục Ox")
        self.assertEqual(b["options"]["B"], "Điểm C. nằm trên trục Oy")
        self.assertEqual(b["options"]["C"], "Điểm D. nằm trên trục Oz")
        self.assertEqual(b["options"]["D"], "Cả 3 điểm trên")

    def test_question_number_without_punctuation(self):
        text = (
            "Câu 14 Tìm x biết 2x + 1 = 5:\n"
            "A. x = 2\n"
            "B. x = 3\n"
            "C. x = 4\n"
            "D. x = 5"
        )
        blocks = parse_mcq_blocks(text)
        self.assertEqual(len(blocks), 1)
        b = blocks[0]
        self.assertEqual(b["source_number"], 14)
        self.assertEqual(b["options"]["A"], "x = 2")
