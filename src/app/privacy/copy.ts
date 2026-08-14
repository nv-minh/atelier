import { CONTACT_EMAIL, type LegalDoc } from "@/lib/legal";

// Every claim here is checked against the code, not aspirational:
//   · stored fields → prisma/schema.prisma (User, Card, ReviewLog, Settings,
//     PushSubscription, WordMark, LearnerProfile, UserProgress, Achievement)
//   · "no analytics" → there is no analytics, ads or tracking SDK anywhere in
//     src/ or package.json. If one is ever added, this file changes first.
//   · outbound hosts → dictionaryapi.dev, zenquotes.io, images.pexels.com,
//     upload.wikimedia.org, raw.githubusercontent.com
//   · export → /api/export (CSV + Anki)
//   · deletion is a manual, email-driven process because there is no
//     self-serve delete route yet. Do not promise a button that does not exist.

export const privacyVi: LegalDoc = {
  title: "Quyền riêng tư",
  intro:
    "Atelier là một ứng dụng học từ vựng miễn phí. Trang này nói rõ dữ liệu nào được lưu, lưu ở đâu, và bạn lấy lại hoặc xoá đi bằng cách nào.",
  sections: [
    {
      heading: "Dữ liệu được lưu",
      body: [
        "Khi bạn đăng nhập bằng Google, chúng tôi lưu tên, địa chỉ email và ảnh đại diện mà Google cung cấp. Chúng tôi không nhận và không lưu mật khẩu Google của bạn.",
        "Trong quá trình học, ứng dụng lưu tiến độ của bạn: lịch ôn từng từ, lịch sử trả lời, các phiên học, thống kê theo ngày, điểm XP, huy hiệu, trình độ ước lượng, cùng các từ bạn gắn sao, ghi chú hoặc đánh dấu đã thuộc.",
        "Trong phần Cài đặt, chúng tôi lưu các tuỳ chọn của bạn: mục tiêu hằng ngày, số thẻ mới, giao diện sáng/tối, ngôn ngữ, giờ nhắc học và múi giờ.",
        "Nếu bạn bật nhắc học, trình duyệt của bạn tạo một đăng ký thông báo (push subscription) và chúng tôi lưu địa chỉ endpoint của nó để gửi nhắc. Đây là một định danh gắn với thiết bị. Tắt nhắc học trong Cài đặt sẽ xoá bản ghi này.",
      ],
    },
    {
      heading: "Dữ liệu lưu ở đâu",
      body: [
        "Dữ liệu học của bạn nằm trong một cơ sở dữ liệu PostgreSQL do Neon vận hành, và ứng dụng chạy trên hạ tầng của Vercel. Dữ liệu không nằm trên máy của bạn — đó là lý do tiến độ đồng bộ được giữa điện thoại và máy tính.",
        "Một số tuỳ chọn nhỏ chỉ nằm trên trình duyệt của bạn và không gửi đi đâu cả: lựa chọn giao diện sáng/tối, ngôn ngữ, bật/tắt âm thanh và rung, và việc bạn đã tắt gợi ý cài app hay chưa.",
      ],
    },
    {
      heading: "Chúng tôi không làm gì",
      body: [
        "Không có quảng cáo, không có công cụ phân tích hành vi, không có mã theo dõi của bên thứ ba nào trong ứng dụng này. Chúng tôi không bán và không chia sẻ dữ liệu của bạn cho bên thứ ba vì mục đích tiếp thị.",
        "Chúng tôi không thu phí và không lưu bất kỳ thông tin thanh toán nào.",
      ],
    },
    {
      heading: "Dịch vụ bên thứ ba",
      body: [
        "Đăng nhập do Google xử lý. Ứng dụng chạy trên Vercel và dùng cơ sở dữ liệu của Neon.",
        "Khi bạn nghe phát âm, trình duyệt của bạn tải file âm thanh từ api.dictionaryapi.dev hoặc raw.githubusercontent.com. Hình minh hoạ được tải từ images.pexels.com và upload.wikimedia.org. Câu trích dẫn hằng ngày lấy từ zenquotes.io qua máy chủ của chúng tôi. Những dịch vụ này có thể thấy địa chỉ IP của bạn theo cách thông thường của mọi yêu cầu web.",
        "Chế độ luyện phát âm dùng tính năng nhận diện giọng nói sẵn có của trình duyệt. Tuỳ trình duyệt, âm thanh có thể được gửi tới nhà cung cấp trình duyệt để xử lý; chúng tôi không nhận, không lưu và không nghe được bản ghi âm nào.",
      ],
    },
    {
      heading: "Lấy lại dữ liệu của bạn",
      body: [
        "Bất cứ lúc nào, bạn có thể xuất toàn bộ từ vựng và tiến độ của mình ra file CSV hoặc file nạp thẳng vào Anki, ngay trong phần Cài đặt.",
      ],
    },
    {
      heading: "Xoá tài khoản",
      body: [
        `Hiện chưa có nút xoá tài khoản trong ứng dụng. Nếu bạn muốn xoá tài khoản cùng toàn bộ dữ liệu học, gửi email tới ${CONTACT_EMAIL} từ chính địa chỉ email bạn dùng để đăng nhập; chúng tôi sẽ xử lý trong vòng 30 ngày.`,
        "Riêng đăng ký nhận thông báo thì bạn tự xoá được ngay: tắt nhắc học trong Cài đặt.",
      ],
    },
    {
      heading: "Trẻ em",
      body: [
        "Ứng dụng không hướng tới trẻ dưới 13 tuổi và chúng tôi không cố ý thu thập dữ liệu của trẻ dưới 13 tuổi.",
      ],
    },
    {
      heading: "Thay đổi",
      body: [
        "Nếu nội dung trang này thay đổi đáng kể, ngày cập nhật ở đầu trang sẽ thay đổi theo.",
      ],
    },
    {
      heading: "Liên hệ",
      body: [`Mọi câu hỏi về quyền riêng tư, gửi tới ${CONTACT_EMAIL}.`],
    },
  ],
};

export const privacyEn: LegalDoc = {
  title: "Privacy",
  intro:
    "Atelier is a free vocabulary app. This page sets out what data is stored, where it lives, and how you get it back or have it deleted.",
  sections: [
    {
      heading: "What is stored",
      body: [
        "When you sign in with Google we store the name, email address and avatar that Google provides. We never receive or store your Google password.",
        "As you study, the app stores your progress: the review schedule for each word, your answer history, study sessions, per-day statistics, XP, badges, your estimated level, and any words you star, annotate or mark as known.",
        "From Settings we store your preferences: daily goal, new-card limit, light/dark theme, language, reminder hour and time zone.",
        "If you turn on reminders, your browser creates a push subscription and we store its endpoint so we can send them. That endpoint is a device-scoped identifier. Turning reminders off in Settings deletes the record.",
      ],
    },
    {
      heading: "Where it lives",
      body: [
        "Your study data sits in a PostgreSQL database operated by Neon, and the app runs on Vercel's infrastructure. It is not stored on your device — that is what lets your progress follow you from phone to desktop.",
        "A few small preferences stay in your browser and are never sent anywhere: light/dark theme, language, sound and haptics toggles, and whether you have dismissed the install prompt.",
      ],
    },
    {
      heading: "What we do not do",
      body: [
        "There are no ads, no behavioural analytics and no third-party tracking scripts in this app. We do not sell or share your data with third parties for marketing.",
        "We charge nothing and store no payment information.",
      ],
    },
    {
      heading: "Third-party services",
      body: [
        "Sign-in is handled by Google. The app is hosted on Vercel and uses a Neon database.",
        "When you play a pronunciation, your browser fetches audio from api.dictionaryapi.dev or raw.githubusercontent.com. Illustrations load from images.pexels.com and upload.wikimedia.org. The daily quote comes from zenquotes.io via our server. These services can see your IP address in the ordinary course of any web request.",
        "The pronunciation drill uses your browser's built-in speech recognition. Depending on the browser, audio may be sent to the browser vendor for processing; we neither receive, store nor hear any recording.",
      ],
    },
    {
      heading: "Getting your data back",
      body: [
        "At any time you can export all of your words and progress as a CSV file, or as a file that imports straight into Anki, from Settings.",
      ],
    },
    {
      heading: "Deleting your account",
      body: [
        `There is no delete button in the app yet. To delete your account and all study data, email ${CONTACT_EMAIL} from the address you sign in with and we will action it within 30 days.`,
        "Push subscriptions are the exception — you can remove those yourself immediately by turning reminders off in Settings.",
      ],
    },
    {
      heading: "Children",
      body: [
        "The app is not directed at children under 13, and we do not knowingly collect data from anyone under 13.",
      ],
    },
    {
      heading: "Changes",
      body: ["If this page changes materially, the date at the top changes with it."],
    },
    {
      heading: "Contact",
      body: [`Privacy questions go to ${CONTACT_EMAIL}.`],
    },
  ],
};
