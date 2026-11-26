/* OTOMATİK: node tools/surum.js (kaynak: package.json + release-notes.json). Elle düzenlemeyin. */
window.APP_RELEASE = {
 "version": "2.15.5",
 "notes": {
  "tr": "Telefonda güncelleme düzeltildi: eski sürümlü telefonlar yanlışlıkla Windows kurulum dosyasını indiriyor ve \"uygulama dosyasında sorun var\" hatası veriyordu. Artık telefon yalnızca kendi APK dosyasını indirir; dosya kurulumdan önce denetlenir. Kayıtlar korunur.",
  "en": "Phone update fixed: phones on older versions were downloading the Windows installer by mistake and showed \"There's a problem with the app file\". The phone now downloads only its own APK, and the file is checked before installing. Records are kept.",
  "ar": "تم إصلاح التحديث على الهاتف: كانت الهواتف ذات الإصدارات القديمة تُنزِّل ملف تثبيت ويندوز عن طريق الخطأ وتُظهر رسالة «هناك مشكلة في ملف التطبيق». أصبح الهاتف الآن يُنزِّل ملف APK الخاص به فقط، ويُفحَص الملف قبل التثبيت. تبقى السجلات محفوظة."
 }
};
window.KITAPLIK_SURUM = window.APP_RELEASE.version;
