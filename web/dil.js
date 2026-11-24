/* Kitaplık — arayüz dili: Türkçe / English / العربية.
   Program metinleri Türkçe yazılı; bu dosya ekrana gelen metin düğümlerini, yer tutucuları ve ipuçlarını
   sözlükten çevirir (sayılar değişkendir), Arapçada sağdan sola yazar. Seçim: localStorage 'kitaplik.dil'.
   Dil düğmesi ortak çekirdeğin sağ üst çubuğundadır. */
(function () {
  'use strict';
  var KEY = 'kitaplik.dil';
  function cur() { var l = ''; try { l = localStorage.getItem(KEY) || ''; } catch (e) {} return /^(tr|en|ar)$/.test(l) ? l : 'tr'; }
  var LANG = cur();

  // [Türkçe, English, العربية]
  var R = [
    // 2.14.0: özet ve ödünç durum metinleri
    ['Geciken kitaplar', 'Overdue books', 'الكتب المتأخرة'], ['7 gün içinde geri alınacaklar', 'Due back within 7 days', 'تُستعاد خلال 7 أيام'],
    ['Zamanı gelen hatırlatmalar', 'Due reminders', 'تذكيرات حان وقتها'], ['{n} gün gecikti', '{n} days overdue', 'متأخر {n} يوم'],
    ['{n} gün kaldı', '{n} days left', 'بقي {n} يوم'], ['Bugün teslim', 'Due today', 'موعد الإعادة اليوم'], ['Yarın teslim', 'Due tomorrow', 'موعد الإعادة غداً'],
    ['Teslim tarihi yok', 'No due date', 'لا يوجد موعد إعادة'], ['İade', 'Return', 'إعادة'], ['💾 Yedekleme', '💾 Backup', '💾 النسخ الاحتياطي'],
    // gezinme, özet
    ['Kitaplık', 'Library', 'المكتبة'], ['Kitaplığım', 'My library', 'مكتبتي'], ['Özet', 'Overview', 'الملخّص'],
    ['Kitaplar', 'Books', 'الكتب'], ['Ödünç', 'Loans', 'الإعارة'], ['Ayarlar', 'Settings', 'الإعدادات'],
    ['Kitap', 'Books', 'كتاب'], ['Ödünçte', 'On loan', 'مُعار'], ['Geciken', 'Overdue', 'متأخر'], ['Okunan', 'Read', 'مقروء'],
    ['Toplam sayfa', 'Total pages', 'إجمالي الصفحات'], ['Bekleyen iade yok.', 'No pending returns.', 'لا توجد إعادات معلّقة.'],
    ['Tüm kitaplar yerinde.', 'All books are in place.', 'جميع الكتب في مكانها.'],
    ['Kategorilere göre', 'By category', 'حسب التصنيف'], ['Konumlara göre', 'By location', 'حسب الموقع'],
    ['Henüz veri yok.', 'No data yet.', 'لا توجد بيانات بعد.'],
    ['{n} kitap ödünçte, teslim tarihi yaklaşan yok.', '{n} books on loan, none due soon.', '{n} كتب مُعارة، ولا يقترب موعد إعادة أيّ منها.'],
    ['Sırala', 'Sort', 'ترتيب'], ['Ad, yazar, yayınevi, ISBN, not…', 'Title, author, publisher, ISBN, note…', 'العنوان، المؤلف، الناشر، ISBN، ملاحظة…'],
    ['★ Favoriler', '★ Favourites', '★ المفضّلة'], ['Kitap ekle', 'Add book', 'إضافة كتاب'], ['Cilt', 'Vol.', 'مجلد'],
    ['nüsha ödünçte', 'copies on loan', 'نسخ مُعارة'], ['Verildi:', 'Lent:', 'أُعير:'],
    // 2.15.2: ödünç satırları ("Verildi: … • Teslim: …", "Veriliş: … • Teslim: …", "… • İade: …")
    ['Veriliş:', 'Lent:', 'أُعير:'], ['Teslim:', 'Due:', 'موعد الإرجاع:'], ['İade:', 'Returned:', 'أُعيد:'],
    ['Kişi veya kitap ara', 'Search person or book', 'ابحث عن شخص أو كتاب'], ['Ödünç takibi', 'Loan tracking', 'متابعة الإعارة'],
    ['Ödünç ver', 'Lend', 'إعارة'], ['Şu an ödünçte kitap yok.', 'No books on loan right now.', 'لا توجد كتب مُعارة حالياً.'],
    ['Geciken kitap yok.', 'No overdue books.', 'لا توجد كتب متأخرة.'],
    ['Henüz iade alınmış kayıt yok.', 'No returned records yet.', 'لا توجد سجلات إعادة بعد.'],
    ['Düzenle', 'Edit', 'تعديل'], ['Sil', 'Delete', 'حذف'], ['Kaydet', 'Save', 'حفظ'], ['Vazgeç', 'Cancel', 'إلغاء'],
    ['Kapat', 'Close', 'إغلاق'], ['Evet', 'Yes', 'نعم'], ['Hayır', 'No', 'لا'], ['Tamam', 'OK', 'حسناً'], ['Onayla', 'Confirm', 'تأكيد'],
    ['Tümü', 'All', 'الكل'], ['Aktif', 'Active', 'نشط'], ['Geçmiş', 'History', 'السجل'], ['İade edilen', 'Returned', 'مُعاد'],
    ['Ara', 'Search', 'بحث'], ['Yeni', 'New', 'جديد'], ['Ekle', 'Add', 'إضافة'],
    // kategoriler, konumlar, sabit listeler
    ['Siyer', 'Prophetic biography (Sīra)', 'السيرة'], ['Fıkıh', 'Fiqh', 'الفقه'], ['Hadis', 'Hadith', 'الحديث'], ['Tefsir', 'Tafsir', 'التفسير'],
    ['Akaid', 'Creed (Aqīda)', 'العقيدة'], ['Tasavvuf', 'Sufism', 'التصوف'], ['İslam Tarihi', 'Islamic history', 'التاريخ الإسلامي'],
    ['Tarih', 'History', 'التاريخ'], ['Roman', 'Novel', 'رواية'], ['Hikâye', 'Short stories', 'قصص'], ['Şiir', 'Poetry', 'شعر'],
    ['Biyografi', 'Biography', 'سيرة ذاتية'], ['Felsefe', 'Philosophy', 'فلسفة'], ['Dil ve Edebiyat', 'Language & literature', 'اللغة والأدب'],
    ['Çocuk', 'Children', 'أطفال'], ['Diğer', 'Other', 'أخرى'],
    ['Salon kitaplığı', 'Living-room bookcase', 'مكتبة الصالون'], ['Çalışma odası', 'Study', 'غرفة المكتب'],
    ['Yatak odası', 'Bedroom', 'غرفة النوم'], ['Depo / Koli', 'Storage / Box', 'المخزن / صندوق'],
    ['Okunmadı', 'Unread', 'لم يُقرأ'], ['Okunuyor', 'Reading', 'قيد القراءة'], ['Okundu', 'Read', 'مقروء'],
    ['Başvuru kitabı', 'Reference book', 'كتاب مرجعي'], ['Çok iyi', 'Very good', 'جيد جداً'], ['İyi', 'Good', 'جيد'], ['Orta', 'Fair', 'متوسط'],
    ['Yıpranmış', 'Worn', 'مُهترئ'], ['Hasarlı', 'Damaged', 'تالف'], ['Satın alma', 'Purchase', 'شراء'], ['Hediye', 'Gift', 'هدية'],
    ['Miras', 'Inheritance', 'ميراث'], ['Takas', 'Swap', 'مقايضة'], ['Karton kapak', 'Paperback', 'غلاف ورقي'],
    ['Ciltli (sert kapak)', 'Hardcover', 'مجلّد (غلاف صلب)'], ['Şömizli', 'With dust jacket', 'بغلاف واقٍ'], ['Deri cilt', 'Leather binding', 'تجليد جلدي'],
    ['Spiralli', 'Spiral-bound', 'حلزوني'], ['Türkçe', 'Turkish', 'التركية'], ['Osmanlıca', 'Ottoman Turkish', 'العثمانية'],
    ['Arapça', 'Arabic', 'العربية'], ['Farsça', 'Persian', 'الفارسية'], ['İngilizce', 'English', 'الإنجليزية'], ['Almanca', 'German', 'الألمانية'],
    ['Fransızca', 'French', 'الفرنسية'], ['Belirtilmedi', 'Not specified', 'غير محدد'], ['Kategorisiz', 'Uncategorised', 'بلا تصنيف'],
    // kitap formu
    ['Kapak görseli', 'Cover image', 'صورة الغلاف'], ['Görseli kaldır', 'Remove image', 'إزالة الصورة'],
    ['Temel bilgiler', 'Basic information', 'المعلومات الأساسية'], ['Yayın bilgileri', 'Publication details', 'معلومات النشر'],
    ['Kategori ve yer', 'Category and place', 'التصنيف والمكان'], ['Durum', 'Status', 'الحالة'], ['★ Favori', '★ Favourite', '★ مفضّل'],
    ['Favori', 'Favourite', 'مفضّل'], ['Edinme bilgisi', 'Acquisition', 'معلومات الاقتناء'], ['Notlar', 'Notes', 'ملاحظات'], ['Not', 'Note', 'ملاحظة'],
    ['İçerik özeti, önemli sayfalar, ithaf, eksik cilt bilgisi…', 'Summary, key pages, dedication, missing volumes…', 'ملخّص المحتوى، الصفحات المهمة، الإهداء، المجلدات الناقصة…'],
    ['Kitap adı gerekli.', 'A book title is required.', 'عنوان الكتاب مطلوب.'], ['Kitap adı', 'Book title', 'عنوان الكتاب'],
    ['Alt başlık', 'Subtitle', 'العنوان الفرعي'], ['Yazar', 'Author', 'المؤلف'], ['Çevirmen', 'Translator', 'المترجم'],
    ['Editör/Hazırlayan', 'Editor/Compiler', 'المحرّر/المُعِدّ'], ['Yayınevi', 'Publisher', 'دار النشر'], ['Dizi', 'Series', 'السلسلة'],
    ['Baskı', 'Edition', 'الطبعة'], ['Basım yılı', 'Year', 'سنة الطبع'], ['Basım yeri', 'Place of printing', 'مكان الطبع'], ['Sayfa', 'Pages', 'الصفحات'],
    ['Dil', 'Language', 'اللغة'], ['Kategori', 'Category', 'التصنيف'], ['Konum', 'Location', 'الموقع'], ['Raf/Sıra', 'Shelf/Row', 'الرف/الصف'],
    ['Raf / Sıra', 'Shelf / Row', 'الرف / الصف'], ['Nüsha', 'Copies', 'النسخ'], ['Okuma durumu', 'Reading status', 'حالة القراءة'],
    ['Fiziksel durum', 'Condition', 'الحالة المادية'], ['Puan', 'Rating', 'التقييم'], ['Edinme tarihi', 'Date acquired', 'تاريخ الاقتناء'],
    ['Edinme şekli', 'How acquired', 'طريقة الاقتناء'], ['Nereden', 'From where', 'من أين'], ['Fiyat', 'Price', 'السعر'],
    ['Ödünçte (kimde)', 'On loan (to whom)', 'مُعار (لمن)'], ['Kapak', 'Cover', 'الغلاف'], ['Kitap ayrıntısı', 'Book details', 'تفاصيل الكتاب'],
    ['Hatırlatma:', 'Reminder:', 'تذكير:'], ['Not:', 'Note:', 'ملاحظة:'], ['Ödünç geçmişi', 'Loan history', 'سجل الإعارة'],
    ['Kaydı sil', 'Delete record', 'حذف السجل'], ['Daha önce ödünç verilmemiş.', 'Never lent before.', 'لم يُعَر من قبل.'],
    ['Eklenme:', 'Added:', 'أُضيف:'], ['· Güncelleme:', '· Updated:', '· التحديث:'], ['Kitabı sil', 'Delete book', 'حذف الكتاب'],
    ['Kitap silindi.', 'Book deleted.', 'حُذف الكتاب.'], ['Kayıt silindi.', 'Record deleted.', 'حُذف السجل.'],
    ['Görsel kaydedilemedi:', 'Image could not be saved:', 'تعذّر حفظ الصورة:'], ['Görsel okunamadı.', 'Image could not be read.', 'تعذّرت قراءة الصورة.'],
    ['Görsel deposu kullanılamıyor.', 'Image storage is unavailable.', 'مخزن الصور غير متاح.'], ['Kapak deposu açılamadı', 'Cover storage could not be opened', 'تعذّر فتح مخزن الأغلفة'],
    ['Kamera açılamadı. Galeriden seçebilirsiniz.', 'Camera could not be opened. You can pick from the gallery.', 'تعذّر فتح الكاميرا. يمكنك الاختيار من المعرض.'],
    ['Bu adda bir kayıt zaten var.', 'A record with this name already exists.', 'يوجد سجل بهذا الاسم بالفعل.'],
    // ödünç
    ['Kime verildi', 'Lent to', 'أُعير إلى'], ['Tarihler', 'Dates', 'التواريخ'], ['Hatırlatma', 'Reminder', 'تذكير'],
    ['Geri alma hatırlatması kur (seçilen zamanda bildirim gelir)', 'Set a return reminder (a notification arrives at the chosen time)', 'ضبط تذكير بالاسترجاع (يصل إشعار في الوقت المحدد)'],
    ['ör. Verilirken kapak yıpranmıştı', 'e.g. The cover was worn when lent', 'مثال: كان الغلاف مهترئاً عند الإعارة'],
    ['Kişi adı gerekli.', 'A name is required.', 'اسم الشخص مطلوب.'], ['Hatırlatma zamanı seçin.', 'Choose a reminder time.', 'اختر وقت التذكير.'],
    ['İade alındı', 'Returned', 'تمت الإعادة'], ['İade kaydedildi.', 'Return recorded.', 'سُجّلت الإعادة.'], ['Kitap ara', 'Search book', 'ابحث عن كتاب'],
    ['Hangi kitap?', 'Which book?', 'أيّ كتاب؟'], ['Verilme tarihi', 'Date lent', 'تاريخ الإعارة'], ['Teslim tarihi', 'Due date', 'تاريخ الإرجاع'],
    ['Kişi', 'Person', 'الشخص'], ['Telefon', 'Phone', 'الهاتف'], ['Gecikti', 'Overdue', 'متأخر'],
    // ayarlar
    ['Firebase eşitleme', 'Firebase sync', 'مزامنة Firebase'],
    ['Telefon ve bilgisayardaki kitaplığı aynı tutar. İnternet yokken çalışmaya devam eder, bağlantı gelince eşitler.', 'Keeps the library on phone and computer identical. Works offline and syncs when the connection returns.', 'يُبقي المكتبة على الهاتف والحاسوب متطابقة. يعمل دون إنترنت ويزامن عند عودة الاتصال.'],
    ['Kategori ekle', 'Add category', 'إضافة تصنيف'], ['Konum ekle', 'Add location', 'إضافة موقع'], ['Kategoriler ({n})', 'Categories ({n})', 'التصنيفات ({n})'],
    ['Konumlar / Raflar ({n})', 'Locations / Shelves ({n})', 'المواقع / الرفوف ({n})'], ['Ödünç ve hatırlatma', 'Loans and reminders', 'الإعارة والتذكير'],
    ['Varsayılan ödünç süresi (gün)', 'Default loan period (days)', 'مدة الإعارة الافتراضية (أيام)'], ['Bildirimi dene', 'Test notification', 'تجربة الإشعار'],
    ['Yedek al (JSON)', 'Back up (JSON)', 'نسخة احتياطية (JSON)'], ['Yedekten yükle', 'Restore from backup', 'استعادة من نسخة احتياطية'],
    ['Excel listesi (CSV)', 'Excel list (CSV)', 'قائمة Excel (CSV)'], ['Yüklü sürüm', 'Installed version', 'الإصدار المثبّت'],
    ['Yeni sürümler Firebase üzerinden otomatik olarak alınır.', 'New versions are downloaded automatically.', 'تُنزَّل الإصدارات الجديدة تلقائياً.'],
    ['Güncellemeleri otomatik indir', 'Download updates automatically', 'تنزيل التحديثات تلقائياً'], ['Güncelle', 'Update', 'تحديث'],
    ['Güncelleme', 'Update', 'التحديث'], ['Yeniden başlat ve güncelle', 'Restart and update', 'إعادة التشغيل والتحديث'], ['Açılış görünümü', 'Start view', 'شاشة البداية'],
    ['Yeni kategori adı', 'New category name', 'اسم التصنيف الجديد'], ['Yeni konum adı', 'New location name', 'اسم الموقع الجديد'],
    ['Kategoriyi sil', 'Delete category', 'حذف التصنيف'], ['Konumu sil', 'Delete location', 'حذف الموقع'],
    ['Bildirimler çalışıyor. Hatırlatmalar böyle görünecek.', 'Notifications work. Reminders will look like this.', 'الإشعارات تعمل. ستظهر التذكيرات هكذا.'],
    ['Deneme bildirimi gönderildi.', 'Test notification sent.', 'أُرسل إشعار تجريبي.'],
    ['Kitaplık kodu en az 12 karakter olmalı.', 'The library code must be at least 12 characters.', 'يجب أن يتكون رمز المكتبة من 12 حرفاً على الأقل.'],
    ['Eşitlemeyi kapat', 'Turn off sync', 'إيقاف المزامنة'], ['Bu cihaz artık eşitlenmeyecek. Kayıtlar cihazda kalır.', 'This device will no longer sync. Records stay on the device.', 'لن يُزامَن هذا الجهاز بعد الآن. تبقى السجلات على الجهاز.'],
    ['Güncellemeler otomatik indirilecek.', 'Updates will download automatically.', 'ستُنزَّل التحديثات تلقائياً.'], ['Otomatik güncelleme kapatıldı.', 'Automatic updates turned off.', 'أُوقف التحديث التلقائي.'],
    ['Görünüm değişti. Uygulama her açılışta böyle açılır.', 'View changed. The app will open like this every time.', 'تغيّر العرض. سيفتح التطبيق هكذا في كل مرة.'],
    ['Yedek yüklendi ({n} kayıt).', 'Backup restored ({n} records).', 'استُعيدت النسخة الاحتياطية ({n} سجل).'], ['Yüklenemedi:', 'Could not load:', 'تعذّر التحميل:'],
    ['Bu dosya bir Kitaplık yedeği değil.', 'This file is not a Library backup.', 'هذا الملف ليس نسخة احتياطية للمكتبة.'],
    ['Eşitleme kapalı', 'Sync off', 'المزامنة متوقفة'], ['Eşitleme', 'Sync', 'المزامنة'], ['Bağlanıyor…', 'Connecting…', 'جارٍ الاتصال…'],
    ['Eşitleme kapalı — kurmak için dokunun', 'Sync off — tap to set up', 'المزامنة متوقفة — اضغط للإعداد'],
    ['Eşitleniyor…', 'Syncing…', 'جارٍ المزامنة…'], ['Eşitlendi', 'Synced', 'تمت المزامنة'], ['Çevrimdışı', 'Offline', 'غير متصل'],
    ['Firestore izin vermedi. Firestore kurallarını kılavuzdaki gibi ayarlayın.', 'Firestore refused access. Set the Firestore rules as in the guide.', 'رفض Firestore الوصول. اضبط قواعد Firestore كما في الدليل.'],
    ['Yapılandırmada apiKey ve projectId bulunamadı. Firebase konsolundaki firebaseConfig bloğunu olduğu gibi yapıştırın.', 'apiKey and projectId not found. Paste the firebaseConfig block from the Firebase console as is.', 'لم يُعثر على apiKey وprojectId. الصق كتلة firebaseConfig من وحدة تحكم Firebase كما هي.'],
    ['İnternet bağlantısı yok', 'No internet connection', 'لا يوجد اتصال بالإنترنت'], ['İndirildi:', 'Downloaded:', 'تم التنزيل:'],
    ['Firebase kurulumu', 'Firebase setup', 'إعداد Firebase'], ['Firebase konsolunu aç', 'Open the Firebase console', 'فتح وحدة تحكم Firebase'],
    ['Eşitlemeyi başlat', 'Start sync', 'بدء المزامنة'], ['Proje oluştur', 'Create project', 'إنشاء مشروع'], ['Yayınla', 'Publish', 'نشر'],
    ['Wi‑Fi eşitleme', 'Wi‑Fi sync', 'مزامنة Wi‑Fi'], ['Kitaplık kodu', 'Library code', 'رمز المكتبة'],
    // yönetici iletişim
    ['✉️ Yönetici ile İletişim', '✉️ Contact the administrator', '✉️ التواصل مع المسؤول'],
    ['Programın daha verimli ve kullanışlı hâle getirilmesine yönelik görüş, öneri ve taleplerinizi bu bölümden iletebilirsiniz. Mesajınız doğrudan program yöneticisine ulaştırılır ve özenle değerlendirilir.',
     'Send your opinions, suggestions and requests for making the program more efficient and useful here. Your message goes directly to the program administrator and is reviewed carefully.',
     'يمكنك إرسال آرائك واقتراحاتك وطلباتك لجعل البرنامج أكثر كفاءة وفائدة من هنا. تصل رسالتك مباشرة إلى مسؤول البرنامج ويتم النظر فيها بعناية.'],
    ['Konu', 'Subject', 'الموضوع'], ['Görüş, öneri veya talebinizi buraya yazınız…', 'Write your opinion, suggestion or request here…', 'اكتب رأيك أو اقتراحك أو طلبك هنا…'],
    ['Adınız Soyadınız', 'Your name', 'الاسم الكامل'], ['(isteğe bağlı)', '(optional)', '(اختياري)'], ['E-posta adresiniz', 'Your e-mail', 'بريدك الإلكتروني'],
    ['(yanıt almak isterseniz)', '(if you want a reply)', '(إن أردت رداً)'], ['Mesajınız', 'Your message', 'رسالتك'],
    ['Mesajlar yalnızca program yöneticisine iletilir.', 'Messages go only to the program administrator.', 'تُرسل الرسائل إلى مسؤول البرنامج فقط.'],
    ['Lütfen mesajınızı en az 10 karakter olacak şekilde yazınız.', 'Please write at least 10 characters.', 'يرجى كتابة 10 أحرف على الأقل.'],
    ['E-posta adresi geçerli görünmüyor.', 'The e-mail address does not look valid.', 'لا يبدو عنوان البريد الإلكتروني صالحاً.'],
    ['Gönderiliyor…', 'Sending…', 'جارٍ الإرسال…'], ['Mesajınız yöneticiye iletildi. Katkınız için teşekkür ederiz.', 'Your message was sent to the administrator. Thank you!', 'أُرسلت رسالتك إلى المسؤول. شكراً لمساهمتك.'],
    ['Mesaj gönderilemedi:', 'Message could not be sent:', 'تعذّر إرسال الرسالة:'], ['Mesajı gönder', 'Send message', 'إرسال الرسالة'],
    // güncelleme şeridi / araç çubuğu
    ['Hız', 'Speed', 'السرعة'], ['Kalan', 'Left', 'المتبقي'], ['Süre', 'Time', 'المدة'], ['İnen', 'Downloaded', 'المُنزَّل'],
    ['Küçült', 'Minimize', 'تصغير'], ['Tam ekran / pencere', 'Full screen / window', 'ملء الشاشة / نافذة'], ['Dil', 'Language', 'اللغة'],
    ['Yeni sürüm hazır', 'New version ready', 'إصدار جديد جاهز'], ['Şimdi güncelle', 'Update now', 'حدّث الآن'], ['Sonra', 'Later', 'لاحقاً'],
    ['Güncel', 'Up to date', 'محدَّث'], ['Program güncel.', 'The program is up to date.', 'البرنامج محدَّث.'],
    ['İndiriliyor…', 'Downloading…', 'جارٍ التنزيل…'], ['Kuruluyor…', 'Installing…', 'جارٍ التثبيت…'],
    ['Ada göre', 'By title', 'حسب العنوان'], ['Yazara göre', 'By author', 'حسب المؤلف'], ['Yayınevine göre', 'By publisher', 'حسب دار النشر'],
    ['Basım yılına göre', 'By year', 'حسب سنة الطبع'], ['Eklenme tarihine göre', 'By date added', 'حسب تاريخ الإضافة'], ['Tüm kategoriler', 'All categories', 'كل التصنيفات'],
    ['Tüm konumlar', 'All locations', 'كل المواقع'], ['Ödünç: hepsi', 'Loan: all', 'الإعارة: الكل'], ['Ödünçte olanlar', 'On loan', 'المُعارة'],
    ['Rafta olanlar', 'On the shelf', 'على الرف'], ['Henüz kitap yok.', 'No books yet.', 'لا توجد كتب بعد.'],
    ['“Kitap ekle” ile başlayın.', 'Start with “Add book”.', 'ابدأ بـ «إضافة كتاب».'], ['Yeni kitap', 'New book', 'كتاب جديد'],
    ['Kaydet + yeni', 'Save + new', 'حفظ + جديد'], ['📷 Kamerayla çek', '📷 Take photo', '📷 التقط صورة'], ['🖼 Galeriden seç', '🖼 Pick from gallery', '🖼 اختر من المعرض'],
    ['Kitap adı *', 'Book title *', 'عنوان الكتاب *'], ['Orijinal adı (tercüme ise)', 'Original title (if translated)', 'العنوان الأصلي (إن كان مترجماً)'],
    ['Çevirmen / Mütercim', 'Translator', 'المترجم'], ['Editör / Hazırlayan / Tahkik', 'Editor / Compiler / Critical edition', 'المحرّر / المُعِدّ / المحقّق'],
    ['Yayınevi / Basımevi', 'Publisher / Printer', 'دار النشر / المطبعة'], ['Basım yeri (şehir)', 'Place of printing (city)', 'مكان الطبع (المدينة)'],
    ['Sayfa sayısı', 'Number of pages', 'عدد الصفحات'], ['Kapak / Cilt türü', 'Cover / binding', 'نوع الغلاف / التجليد'], ['Konum / Kitaplık', 'Location / Bookcase', 'الموقع / المكتبة'],
    ['Nüsha adedi', 'Number of copies', 'عدد النسخ'], ['Puanım', 'My rating', 'تقييمي'], ['ör. 3. Baskı', 'e.g. 3rd edition', 'مثال: الطبعة الثالثة'],
    ['ör. 2 veya 2/5', 'e.g. 2 or 2/5', 'مثال: 2 أو 2/5'], ['ör. 3. raf, soldan 2. sıra', 'e.g. shelf 3, 2nd row from left', 'مثال: الرف 3، الصف الثاني من اليسار'],
    ['Ödünçte ({n})', 'On loan ({n})', 'مُعار ({n})'], ['Gecikmiş ({n})', 'Overdue ({n})', 'متأخر ({n})'], ['Geçmiş ({n})', 'History ({n})', 'السجل ({n})'],
    ['1) Firebase yapılandırması', '1) Firebase configuration', '١) إعداد Firebase'], ['(firebaseConfig bloğunu yapıştırın)', '(paste the firebaseConfig block)', '(الصق كتلة firebaseConfig)'],
    ['2) Kitaplık kodu', '2) Library code', '٢) رمز المكتبة'],
    ['(ilk cihazda yeni kod oluşur; ikinci cihazda ilkinin kodunu yazın)', '(a new code is created on the first device; type that code on the second device)', '(يُنشأ رمز جديد على الجهاز الأول؛ اكتب رمزه على الجهاز الثاني)'],
    ['Yeni kod', 'New code', 'رمز جديد'], ['Nasıl kurulur?', 'How to set up?', 'كيفية الإعداد؟'], ['Öneri', 'Tip', 'اقتراح'],
    ['Yedekten yükleme mevcut kayıtları silmez; yedekteki kayıtları ekler, aynı kayıtların yenisini tutar.', 'Restoring does not delete existing records; it adds the backup records and keeps the newer of identical ones.', 'الاستعادة لا تحذف السجلات الحالية؛ تضيف سجلات النسخة الاحتياطية وتحتفظ بالأحدث من السجلات المتطابقة.'],
    ['adresine Google hesabınızla girin,', 'sign in with your Google account,', 'وسجّل الدخول بحساب Google،'], ['Sol menüden', 'From the left menu', 'من القائمة اليسرى'],
    ['Firestore Database → Veritabanı oluştur', 'Firestore Database → Create database', 'Firestore Database ← إنشاء قاعدة بيانات'], ['. Konum:', '. Location:', '. الموقع:'],
    ['üretim modu', 'production mode', 'وضع الإنتاج'], ['sekmesine şunu yapıştırıp', 'tab, paste this and', '، الصق هذا ثم'], ['Proje ana sayfasında', 'On the project home page', 'في الصفحة الرئيسية للمشروع'],
    ['simgesiyle bir web uygulaması ekleyin. Gösterilen', 'icon add a web app. Copy the shown', 'أضف تطبيق ويب بالأيقونة. انسخ'],
    ['bloğunu kopyalayıp buradaki kutuya yapıştırın.', 'block and paste it into the box here.', 'المعروضة والصقها في المربع هنا.'], ['İlk cihazda', 'On the first device', 'على الجهاز الأول'],
    ["deyin. Diğer cihazda aynı firebaseConfig'i ve", 'On the other device use the same firebaseConfig and', 'وعلى الجهاز الآخر استخدم نفس firebaseConfig و'], ['aynı kitaplık kodunu', 'the same library code', 'نفس رمز المكتبة'],
    ['deyin:', ':', ':'], ['deyin (ad: kitaplik). Analytics gerekmez.', '(name: kitaplik). Analytics is not needed.', '(الاسم: kitaplik). لا حاجة إلى Analytics.'],
    ["Firestore'da", 'In Firestore,', 'في Firestore،'], ['Kurallar (Rules)', 'Rules', 'القواعد (Rules)'],
    ['Kitaplık kodu bir parola gibidir; kodu bilen kitaplığınızı görebilir. Kimseyle paylaşmayın.', 'The library code is like a password; anyone who knows it can see your library. Do not share it.', 'رمز المكتبة مثل كلمة المرور؛ من يعرفه يمكنه رؤية مكتبتك. لا تشاركه مع أحد.'],
    ['Kategoriyi düzenle', 'Edit category', 'تعديل التصنيف'], ['Kategori adı', 'Category name', 'اسم التصنيف'], ['ör. Tefsir', 'e.g. Tafsir', 'مثال: التفسير'],
    ['Yeni kategori', 'New category', 'تصنيف جديد'], ['Konumu düzenle', 'Edit location', 'تعديل الموقع'], ['Konum adı', 'Location name', 'اسم الموقع'],
    ['Açıklama (isteğe bağlı)', 'Description (optional)', 'الوصف (اختياري)'], ['ör. Salon - Büyük kitaplık', 'e.g. Living room - big bookcase', 'مثال: الصالون - المكتبة الكبيرة'],
    ['ör. 5 raflı, cam kapaklı', 'e.g. 5 shelves, glass doors', 'مثال: 5 رفوف، بأبواب زجاجية'], ['Yeni konum', 'New location', 'موقع جديد'],
    ['Yer ve sınıflandırma', 'Place and classification', 'المكان والتصنيف'], ['🖨 Yayın bilgileri', '🖨 Publication details', '🖨 معلومات النشر'],
    ['Konumu belirtilmemiş', 'Location not specified', 'الموقع غير محدد'],
    ['"{s}" silinsin mi?', 'Delete "{s}"?', 'هل تريد حذف "{s}"؟'], ['"{s}" eklendi. Sıradaki kitabı girebilirsiniz.', '"{s}" added. You can enter the next book.', 'أُضيف "{s}". يمكنك إدخال الكتاب التالي.'],
    ['Kitaplık {s} · web', 'Library {s} · web', 'المكتبة {s} · web'], ['Kitaplık {s} · masaüstü', 'Library {s} · desktop', 'المكتبة {s} · سطح المكتب'], ['Kitaplık {s} · Android', 'Library {s} · Android', 'المكتبة {s} · Android']
  ];

  var EX = {}, PAT = [];
  R.forEach(function (r) {
    var i = LANG === 'en' ? 1 : 2;
    if (/\{[ns]\}/.test(r[0])) {
      var esc = r[0].replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      var key = /\{n\}/.test(r[0]) ? 'n' : 's';
      var rx = new RegExp('^' + esc.replace('{' + key + '}', key === 'n' ? '(\\d[\\d.,]*)' : '(.+?)') + '$');
      PAT.push([rx, r[i], key]);
    } else EX[r[0]] = r[i];
  });
  // ekte numara: "Kategoriler (3)" gibi; sözlükte yoksa sayıyı ayırıp dene
  function tr1(s) {
    var k = s.trim();
    if (!k) return null;
    if (EX[k] !== undefined) return s.replace(k, EX[k]);
    for (var j = 0; j < PAT.length; j++) {
      var m = PAT[j][0].exec(k);
      if (m) { var val = PAT[j][2] === 's' && EX[m[1]] !== undefined ? EX[m[1]] : m[1]; return s.replace(k, PAT[j][1].replace('{' + PAT[j][2] + '}', val)); }
    }
    // tarih içeren satırlar: yalnız sabit parçalar çevrilir
    if (/^Eklenme: /.test(k)) return s.replace('Eklenme:', EX['Eklenme:']).replace('· Güncelleme:', EX['· Güncelleme:']);
    if (/^(Verildi|Veriliş): /.test(k))
      return s.replace(/(Verildi|Veriliş):/, function (x) { return EX[x]; }).replace(/• (Teslim|İade):/, function (x, w) { return '• ' + EX[w + ':']; });
    var m2 = /^(.*?)([:：]?)$/.exec(k);
    if (m2 && m2[2] && EX[m2[1]] !== undefined) return s.replace(k, EX[m2[1]] + m2[2]);
    return null;
  }
  var ATTR = ['placeholder', 'title', 'aria-label'];
  var busy = false;
  function walk(root) {
    if (LANG === 'tr' || !root) return;
    busy = true;
    try {
      if (root.nodeType === 3) { var v = tr1(root.nodeValue); if (v !== null && v !== root.nodeValue) root.nodeValue = v; return; }
      if (root.nodeType !== 1 || root.closest('[data-notr],script,style')) return;
      var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT), n = root;
      do {
        if (n.nodeType === 3) {
          var p = n.parentNode;
          if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) continue;
          if (p && p.closest && p.closest('[data-notr],.book-title,.title-cell')) continue;
          var t = tr1(n.nodeValue); if (t !== null && t !== n.nodeValue) n.nodeValue = t;
        } else if (n.nodeType === 1) {
          for (var a = 0; a < ATTR.length; a++) { var av = n.getAttribute(ATTR[a]); if (av) { var tt = tr1(av); if (tt !== null && tt !== av) n.setAttribute(ATTR[a], tt); } }
        }
      } while ((n = w.nextNode()));
    } finally { busy = false; }
  }
  function apply() {
    document.documentElement.lang = LANG;
    document.documentElement.dir = LANG === 'ar' ? 'rtl' : 'ltr';
    if (LANG === 'tr') return;
    walk(document.body);
    var tl = tr1(document.title); if (tl) document.title = tl;
    new MutationObserver(function (ms) {
      if (busy) return;
      ms.forEach(function (m) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') walk(m.target);
        else m.addedNodes.forEach(walk);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }

  // Dil seçici ortak çekirdeğin üst çubuğunda (TR · EN · ع); seçim kabuk.js'te 'kitaplik.dil'e yazılır ve sayfa yeniden yüklenir.

  window.KitaplikDil = { lang: LANG, t: function (s) { var v = tr1(s); return v === null ? s : v; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
