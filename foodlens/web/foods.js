// Offline food table for the "Tra cứu" tab. Values are per 100 g edible portion (typical
// figures from public food-composition tables, rounded); gi is the typical glycemic index,
// nova the processing group, serving_g a common portion. Works with no network and no key.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FoodLensFoods = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  function f(vi, en, kcal, carbs, fiber, sugar, protein, fat, gi, nova, serving_g, extra) {
    return Object.assign({ vi: vi, en: en, kcal: kcal, carbs: carbs, fiber: fiber, sugar: sugar, protein: protein, fat: fat, gi: gi, nova: nova, serving_g: serving_g }, extra || {});
  }
  return [
    // Trái cây
    f('Táo', 'Apple', 52, 13.8, 2.4, 10.4, 0.3, 0.2, 36, 1, 180),
    f('Chuối', 'Banana', 89, 22.8, 2.6, 12.2, 1.1, 0.3, 51, 1, 120),
    f('Cam', 'Orange', 47, 11.8, 2.4, 9.4, 0.9, 0.1, 43, 1, 150),
    f('Xoài chín', 'Mango', 60, 15, 1.6, 13.7, 0.8, 0.4, 51, 1, 200),
    f('Dưa hấu', 'Watermelon', 30, 7.6, 0.4, 6.2, 0.6, 0.2, 72, 1, 250),
    f('Thanh long', 'Dragon fruit', 57, 13, 3, 8, 1.2, 0.4, 50, 1, 250),
    f('Ổi', 'Guava', 68, 14.3, 5.4, 8.9, 2.6, 1, 20, 1, 150),
    f('Bưởi', 'Pomelo', 38, 9.6, 1, 7, 0.8, 0, 30, 1, 200),
    f('Nho', 'Grapes', 69, 18.1, 0.9, 15.5, 0.7, 0.2, 53, 1, 120),
    f('Sầu riêng', 'Durian', 147, 27.1, 3.8, 20, 1.5, 5.3, 49, 1, 100),
    f('Bơ', 'Avocado', 160, 8.5, 6.7, 0.7, 2, 14.7, 15, 1, 100, { sat: 2.1 }),
    f('Dâu tây', 'Strawberry', 32, 7.7, 2, 4.9, 0.7, 0.3, 40, 1, 150),
    // Tinh bột
    f('Cơm trắng', 'White rice, cooked', 130, 28.2, 0.4, 0.1, 2.7, 0.3, 73, 1, 150),
    f('Cơm gạo lứt', 'Brown rice, cooked', 123, 25.6, 1.6, 0.2, 2.7, 1, 55, 1, 150),
    f('Bún tươi', 'Rice vermicelli, cooked', 110, 25, 0.5, 0, 1.7, 0.2, 58, 3, 180),
    f('Bánh phở', 'Pho rice noodles, cooked', 108, 24, 0.9, 0, 1.8, 0.2, 61, 3, 200),
    f('Bánh mì trắng', 'White baguette', 270, 52, 2.5, 3, 9, 3, 75, 3, 90, { sodium: 550 }),
    f('Bánh mì nguyên cám', 'Whole-wheat bread', 247, 41, 7, 6, 13, 3.4, 54, 3, 60, { sodium: 450 }),
    f('Mì gói', 'Instant noodles, dry', 450, 60, 2.5, 2, 9, 19, 52, 4, 75, { sat: 8.5, sodium: 1800 }),
    f('Yến mạch', 'Rolled oats, dry', 379, 67.7, 10.1, 1, 13.2, 6.5, 55, 1, 40),
    f('Khoai lang luộc', 'Sweet potato, boiled', 86, 20.1, 3, 6.5, 1.6, 0.1, 61, 1, 150),
    f('Khoai tây luộc', 'Potato, boiled', 87, 20.1, 1.8, 0.9, 1.9, 0.1, 78, 1, 150),
    f('Bắp luộc', 'Sweet corn, boiled', 96, 21, 2.4, 4.5, 3.4, 1.5, 52, 1, 150),
    f('Xôi nếp', 'Sticky rice, cooked', 180, 39, 1, 0.1, 3.5, 0.5, 87, 1, 150),
    // Đạm
    f('Ức gà áp chảo', 'Chicken breast, cooked', 165, 0, 0, 0, 31, 3.6, 0, 1, 120, { sat: 1, sodium: 75 }),
    f('Trứng gà luộc', 'Egg, boiled', 155, 1.1, 0, 1.1, 12.6, 10.6, 0, 1, 50, { sat: 3.3, sodium: 125 }),
    f('Cá hồi áp chảo', 'Salmon, cooked', 206, 0, 0, 0, 22, 12.4, 0, 1, 120, { sat: 2.5, sodium: 60 }),
    f('Thịt bò nạc', 'Lean beef, cooked', 217, 0, 0, 0, 26, 11.8, 0, 1, 100, { sat: 4.6, sodium: 60 }),
    f('Thịt heo nạc', 'Lean pork, cooked', 196, 0, 0, 0, 27, 9, 0, 1, 100, { sat: 3.2, sodium: 60 }),
    f('Tôm luộc', 'Shrimp, boiled', 99, 0.2, 0, 0, 24, 0.3, 0, 1, 100, { sodium: 110 }),
    f('Đậu hũ', 'Tofu', 76, 1.9, 0.3, 0.6, 8.1, 4.8, 15, 3, 100, { sat: 0.7 }),
    f('Chả lụa', 'Vietnamese pork sausage', 230, 2, 0, 1, 16, 17, 28, 4, 50, { sat: 6, sodium: 800 }),
    f('Xúc xích', 'Sausage', 300, 2, 0, 1, 12, 27, 28, 4, 50, { sat: 9.5, sodium: 850 }),
    // Rau củ, đậu, hạt
    f('Rau muống luộc', 'Water spinach, boiled', 20, 3.1, 2.1, 0.5, 2.6, 0.2, 15, 1, 150),
    f('Bông cải xanh', 'Broccoli, steamed', 35, 7.2, 3.3, 1.4, 2.4, 0.4, 15, 1, 120),
    f('Dưa leo', 'Cucumber', 15, 3.6, 0.5, 1.7, 0.7, 0.1, 15, 1, 100),
    f('Cà chua', 'Tomato', 18, 3.9, 1.2, 2.6, 0.9, 0.2, 15, 1, 100),
    f('Cà rốt', 'Carrot', 41, 9.6, 2.8, 4.7, 0.9, 0.2, 39, 1, 80),
    f('Đậu phộng rang', 'Peanuts, roasted', 585, 21.5, 8, 4.9, 23.7, 49.7, 14, 1, 30, { sat: 6.9 }),
    f('Hạnh nhân', 'Almonds', 579, 21.6, 12.5, 4.4, 21.2, 49.9, 15, 1, 30, { sat: 3.8 }),
    f('Đậu xanh nấu chín', 'Mung beans, cooked', 105, 19.2, 7.6, 2, 7, 0.4, 31, 1, 100),
    // Sữa, đồ uống
    f('Sữa tươi không đường', 'Whole milk, unsweetened', 61, 4.8, 0, 4.8, 3.2, 3.3, 31, 1, 200, { sat: 1.9, sodium: 43 }),
    f('Sữa chua không đường', 'Plain yogurt', 61, 4.7, 0, 4.7, 3.5, 3.3, 35, 1, 100, { sat: 2.1, sodium: 46 }),
    f('Sữa đặc có đường', 'Sweetened condensed milk', 321, 54.4, 0, 54.4, 7.9, 8.7, 61, 4, 30, { added: 43, sat: 5.5, sodium: 127 }),
    f('Cà phê đen không đường', 'Black coffee, unsweetened', 2, 0, 0, 0, 0.3, 0, 0, 1, 240),
    f('Cà phê sữa đá', 'Vietnamese iced milk coffee', 85, 14, 0, 13.5, 2, 2.3, 61, 4, 180, { added: 11, sat: 1.4 }),
    f('Trà sữa trân châu', 'Bubble milk tea', 78, 15.5, 0.1, 9.5, 0.6, 1.6, 68, 4, 500, { added: 9.5, sat: 1.2 }),
    f('Nước ngọt có ga', 'Cola soft drink', 42, 10.6, 0, 10.6, 0, 0, 63, 4, 330, { added: 10.6 }),
    f('Nước dừa tươi', 'Coconut water', 19, 3.7, 1.1, 2.6, 0.7, 0.2, 54, 1, 300, { sodium: 105 }),
    f('Bia', 'Beer', 43, 3.6, 0, 0, 0.5, 0, 66, 3, 330),
    // Món ăn
    f('Phở bò', 'Beef pho', 75, 9.5, 0.4, 0.8, 5, 1.7, 61, 3, 550, { sat: 0.6, sodium: 320 }),
    f('Bún chả', 'Grilled pork with vermicelli', 150, 17, 0.8, 3, 8, 5.5, 58, 3, 400, { added: 2, sat: 2, sodium: 380 }),
    f('Cơm tấm sườn', 'Broken rice with grilled pork chop', 185, 24, 0.5, 2.5, 8.5, 6, 73, 3, 400, { added: 1.5, sat: 2.2, sodium: 330 }),
    f('Bánh mì thịt', 'Vietnamese banh mi sandwich', 245, 30, 1.8, 3.5, 11, 9, 72, 4, 220, { added: 1, sat: 3, sodium: 620 }),
    f('Gỏi cuốn', 'Fresh spring rolls', 110, 15, 1, 1.5, 6.5, 2.5, 55, 3, 160, { sodium: 280 }),
    f('Chả giò chiên', 'Fried spring rolls', 290, 22, 1.5, 2, 9, 18, 60, 3, 100, { sat: 4.5, sodium: 480 }),
    f('Pizza', 'Pizza, cheese', 266, 33, 2.3, 3.6, 11, 10, 60, 4, 200, { added: 1, sat: 4.5, sodium: 600 }),
    f('Hamburger', 'Hamburger', 254, 24, 1.3, 4.5, 13, 12, 66, 4, 200, { added: 2.5, sat: 4.7, sodium: 500 }),
    f('Khoai tây chiên', 'French fries', 312, 41, 3.8, 0.3, 3.4, 15, 75, 4, 120, { sat: 2.3, sodium: 210 }),
    f('Sushi cá hồi', 'Salmon nigiri sushi', 150, 22, 0.4, 3, 8, 3.2, 62, 3, 180, { added: 2, sat: 0.7, sodium: 330 }),
    f('Salad rau trộn dầu giấm', 'Green salad with vinaigrette', 60, 5, 2, 2.5, 1.3, 4, 15, 2, 200, { sat: 0.6, sodium: 150 }),
    f('Chè đậu', 'Sweet bean dessert', 130, 26, 2.5, 16, 3, 1.5, 65, 3, 250, { added: 14, sat: 1.2 }),
    f('Bánh ngọt kem', 'Cream cake', 350, 46, 0.8, 30, 4.5, 16.5, 65, 4, 90, { added: 28, sat: 9, sodium: 250 }),
    f('Sô cô la đen 70%', 'Dark chocolate 70%', 598, 45.9, 10.9, 24, 7.8, 42.6, 23, 4, 20, { added: 22, sat: 24.5 }),
  ];
});
