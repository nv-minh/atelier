import { CONTACT_EMAIL, type LegalDoc } from "@/lib/legal";

// The content-licensing section is not boilerplate: data/SOURCES.md documents
// genuinely mixed terms on the vocabulary that ships with this app — NGSL/BSL/
// TSL under CC BY 3.0, Wiktionary-derived glosses under CC BY-SA 3.0, and a
// Vietnamese dictionary licensed for non-commercial use only. Saying "all
// rights reserved" here would misstate what we are allowed to grant.

export const termsVi: LegalDoc = {
  title: "Điều khoản sử dụng",
  intro:
    "Những điều khoản ngắn gọn cho việc dùng Atelier. Dùng ứng dụng nghĩa là bạn đồng ý với chúng.",
  sections: [
    {
      heading: "Dịch vụ",
      body: [
        "Atelier là ứng dụng học từ vựng miễn phí, không quảng cáo. Không có gói trả phí, không có thu phí ẩn.",
        "Đây là một dự án cá nhân đang phát triển. Tính năng có thể thay đổi hoặc bị gỡ bỏ, và dịch vụ có thể gián đoạn. Chúng tôi không cam kết mức độ sẵn sàng nào.",
      ],
    },
    {
      heading: "Tài khoản của bạn",
      body: [
        "Bạn cần một tài khoản Google để lưu tiến độ. Bạn chịu trách nhiệm cho hoạt động diễn ra dưới tài khoản của mình.",
        "Chúng tôi có thể tạm ngưng tài khoản có hành vi phá hoại dịch vụ hoặc gây ảnh hưởng tới người dùng khác.",
      ],
    },
    {
      heading: "Nội dung học và bản quyền",
      body: [
        "Kho từ vựng trong ứng dụng được tổng hợp từ nhiều nguồn mở với các giấy phép khác nhau: danh sách tần suất NGSL, BSL và TSL theo giấy phép CC BY 3.0; phần định nghĩa có nguồn gốc Wiktionary theo CC BY-SA 3.0; phần nghĩa tiếng Việt lấy từ từ điển mở chỉ cho phép sử dụng phi thương mại. Hình minh hoạ đến từ Pexels và Wikimedia Commons theo giấy phép riêng của từng ảnh.",
        "Vì vậy, nội dung học trong ứng dụng không thuộc sở hữu của chúng tôi và không được cấp phép lại cho bạn ngoài phạm vi các giấy phép gốc. Bạn được tự do dùng cho việc học của mình, kể cả xuất ra để dùng trong Anki.",
        "Mã nguồn của ứng dụng được phát hành riêng theo giấy phép ghi trong kho mã.",
      ],
    },
    {
      heading: "Sử dụng hợp lý",
      body: [
        "Đừng cố truy cập dữ liệu của người khác, đừng dò quét hay tự động hoá ở mức gây tải bất thường, và đừng dùng ứng dụng cho việc trái pháp luật.",
      ],
    },
    {
      heading: "Không bảo đảm",
      body: [
        "Dịch vụ được cung cấp \"nguyên trạng\". Chúng tôi cố gắng giữ dữ liệu học của bạn an toàn nhưng không bảo đảm không bao giờ mất mát — hãy dùng chức năng xuất dữ liệu nếu tiến độ của bạn quan trọng với bạn.",
        "Nội dung định nghĩa và bản dịch có thể có sai sót. Đây không phải tài liệu tham khảo học thuật.",
      ],
    },
    {
      heading: "Thay đổi",
      body: [
        "Nếu các điều khoản này thay đổi đáng kể, ngày cập nhật ở đầu trang sẽ thay đổi theo.",
      ],
    },
    {
      heading: "Liên hệ",
      body: [`Mọi câu hỏi, gửi tới ${CONTACT_EMAIL}.`],
    },
  ],
};

export const termsEn: LegalDoc = {
  title: "Terms of use",
  intro: "Short terms for using Atelier. Using the app means you accept them.",
  sections: [
    {
      heading: "The service",
      body: [
        "Atelier is a free vocabulary app with no ads. There is no paid tier and no hidden charge.",
        "It is a personal project under active development. Features may change or be withdrawn, and the service may be interrupted. We offer no availability guarantee.",
      ],
    },
    {
      heading: "Your account",
      body: [
        "You need a Google account to save progress. You are responsible for activity under your account.",
        "We may suspend accounts that disrupt the service or affect other users.",
      ],
    },
    {
      heading: "Study content and licensing",
      body: [
        "The vocabulary in this app is assembled from open sources under differing licences: the NGSL, BSL and TSL frequency lists under CC BY 3.0; Wiktionary-derived definitions under CC BY-SA 3.0; and Vietnamese glosses from an open dictionary licensed for non-commercial use only. Illustrations come from Pexels and Wikimedia Commons under their own per-image terms.",
        "The study content is therefore not ours, and is not sub-licensed to you beyond those original licences. You are free to use it for your own learning, including exporting it into Anki.",
        "The application's source code is released separately under the licence stated in its repository.",
      ],
    },
    {
      heading: "Acceptable use",
      body: [
        "Do not attempt to reach other people's data, do not scrape or automate at a rate that loads the service abnormally, and do not use the app for anything unlawful.",
      ],
    },
    {
      heading: "No warranty",
      body: [
        'The service is provided "as is". We try to keep your study data safe but cannot guarantee against loss — use the export if your progress matters to you.',
        "Definitions and translations may contain errors. This is not an academic reference.",
      ],
    },
    {
      heading: "Changes",
      body: ["If these terms change materially, the date at the top changes with them."],
    },
    {
      heading: "Contact",
      body: [`Questions go to ${CONTACT_EMAIL}.`],
    },
  ],
};
