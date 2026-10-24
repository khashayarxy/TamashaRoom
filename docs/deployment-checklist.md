# راهنمای انتشار کنترل‌شده تماشاروم

این سند برای انتشار آینده است؛ اجرای Phase 3 فقط محلی است. نسخه مرجع این راهنما جایگزین دستورهای قدیمی `git pull` بدون SHA یا ساخت Node روی cPanel می‌شود. استقرار در این هاست به پنجره نگهداری کوتاه نیاز دارد؛ بدون قطعی تضمین نشده است.

## مرز عملیات

| مورد | مسیر تأییدشده |
|---|---|
| ریشه برنامه | `/home/zizolear/public_html/tamasharoom` |
| ریشه وب | `/home/zizolear/public_html/tamasharoom/public` |
| محیط تولید | `/home/zizolear/public_html/tamasharoom/.env` |
| پوشه مشترک حساب؛ خارج از محدوده تغییر | `/home/zizolear/public_html` |

زیزولرن، پوشه‌های ربات/پرداخت، دیتابیس‌های دیگر و تنظیمات عمومی حساب در محدوده انتشار تماشاروم نیستند. از حذف، همگام‌سازی با `--delete`، تغییر مجوز بازگشتی یا جایگزینی ریشه مشترک استفاده نکنید. پیش از هر فرمانِ تغییر، مسیر واقعی را کنترل کنید:

```bash
cd /home/zizolear/public_html/tamasharoom || exit 1
[ "$(pwd -P)" = '/home/zizolear/public_html/tamasharoom' ] || exit 1
```

اگر مسیر واقعی متفاوت است یا برنامه symlink شده، توقف و بازبینی کنید؛ فرمان را برای دور زدن کنترل تغییر ندهید. همه فرمان‌های بعدی فقط در همین مسیر اجرا می‌شوند.

## پیش‌نیازهای انتشار

- مجوز مستقل استقرار، SHA کامل تأییدشده و CI سبز همان SHA؛ این مرحله commit یا push نمی‌کند.
- staging با PHP 8.4، افزونه cURL، Composer و تنظیمات مشابه تولید. Node فقط روی ماشین ساخت است؛ نسخه CI فعلاً Node 24 است.
- بازبینی diff بین SHA واقعاً مستقر و نسخه هدف؛ `89e0bcd` صرفاً خط مبنای ممیزی قبلی است و باید دوباره بررسی شود.
- ثبت SHA قبلی، `git status --short` و هر تغییر مخصوص میزبان. تغییر ناشناخته یا dirty tree را با force/reset پاک نکنید.
- بکاپ خارج از web root و ترجیحاً خارج از حساب: دیتابیس اختصاصی تماشاروم، `.env` با APP_KEY فعلی، storage خصوصی، کد و lockfile قبلی، manifest و دارایی‌های همان انتشار. بکاپ اسرار باید خصوصی بماند.
- آزمون واقعی بازیابی بکاپ در محیط جداگانه. داشتن فایل بکاپ به‌تنهایی اثبات بازیابی نیست.
- بررسی فضای آزاد و inode؛ ممیزی قبلی سهمیه حساب را ۵GB و مصرف حدود ۶۴٪ گزارش کرد. قبل از انتشار مقدار زنده را بررسی کنید؛ بکاپ‌ها و دو نسخه دارایی نباید سهمیه مشترک را پر کنند.
- بررسی فهرست migrationها و سازگاری بازگشت. Phase 3 migration جدید ندارد؛ drift نسخه تولید ممکن است migration دیگری داشته باشد. `migrate --pretend` صرفاً برای migrationهای بازبینی‌شده در staging است.

## فایل‌های پایدار و فایل‌های میزبان

- `.env` و APP_KEY موجود را حفظ کنید؛ از `cp .env.example .env` و `key:generate` روی نصب موجود استفاده نکنید.
- کل `storage/`، به‌خصوص `storage/app/private/subtitles/`، session/queue/cache دیتابیس و بکاپ‌های خصوصی حفظ شوند. لینک عمومی storage برای زیرنویس لازم نیست.
- تغییرات تولید در `.htaccess`، `public/.htaccess`، `.user.ini` و `php.ini` را قبل از جایگزینی بررسی کنید. بلوک PHP تولیدشده توسط cPanel و قواعد امنیتی/هدرهای برنامه باید آگاهانه ادغام شوند.
- کش‌های `bootstrap/cache/` را بین نسخه‌ها کپی نکنید؛ برای کد و محیط همان انتشار بازتولید کنید. `storage/` و `bootstrap/cache/` باید برای حساب PHP قابل نوشتن باشند؛ مجوز 777 ندهید.
- `public/index.php` استاندارد Laravel باقی می‌ماند؛ انتقال `.env` یا تغییر entrypoint برای حل مسیرها لازم نیست.

## ساخت و بسته دارایی؛ خارج از سرور

1. در checkout تمیز SHA هدف، `composer install` و `npm ci` از lockfile اجرا شود؛ آزمون‌ها و auditها موفق باشند.
2. مقادیر عمومی `VITE_*` مخصوص محیط هدف را پیش از ساخت بررسی کنید. کلید خصوصی Pusher یا توکن سرویس نباید وارد bundle شود.
3. `scripts/deploy-package.ps1` ساخت انتشار را اجرا می‌کند. برای بسته‌بندی build ازپیش‌تأییدشده می‌توان `-SkipBuild` داد؛ این گزینه تازگی فایل‌ها را اثبات نمی‌کند.
4. ZIP باید فقط زیرشاخه `build/` داشته باشد، از جمله `build/manifest.json` و `build/assets/*`. بسته‌ساز این ساختار و فایل‌های manifest را کنترل می‌کند و artifact قبلی را بازنویسی نمی‌کند؛ `-OutputPath` جدید انتخاب کنید.
5. SHA منبع، checksum بسته و زمان ساخت را خارج از web root ثبت کنید. بسته آزمایشی Phase 3 با محیط محلی ساخته شده و آماده بارگذاری تولید محسوب نمی‌شود.
6. بسته در **ریشه وب تأییدشده تماشاروم** استخراج می‌شود تا `public/build/manifest.json` ایجاد شود. manifest را قبل از کامل‌شدن upload دارایی‌های جدید فعال نکنید. hashهای قدیمی را برای تب‌های باز و rollback نگه دارید؛ حذف بعدی باید با فهرست صریح فایل‌های همان برنامه و پس از پایان مهلت پشتیبانی انجام شود. ZIP را پس از انتقال از web root بردارید.

## ترتیب اعمال در پنجره نگهداری

پس از کنترل مسیر و بکاپ، پیش از جایگزینی فایل‌های زنده، ترافیک تماشاروم را وارد حالت نگهداری کنید:

```bash
php artisan down --retry=60
```

cron فعلی را حذف یا ویرایش نکنید. Laravel به‌صورت پیش‌فرض schedule و queue را هنگام maintenance اجرا نمی‌کند؛ پایان batch در حال اجرا (تا ۳۰ ثانیه) را بررسی کنید. سپس:

1. کد SHA هدفِ بررسی‌شده و دارایی‌های همان SHA را با حفظ فایل‌های پایدار مستقر کنید. روی dirty tree توقف کنید. `git pull` متحرک یا force checkout جای SHA صریح را نمی‌گیرد.
2. داخل ریشه تأییدشده فقط وابستگی PHP همان lockfile را نصب کنید:

```bash
composer install --no-dev --prefer-dist --no-interaction --optimize-autoloader
composer check-platform-reqs --no-dev
```

3. `.env` موجود باید `APP_ENV=production`، `APP_DEBUG=false`، `APP_URL=https://tamasharoom.ir`، `SESSION_SECURE_COOKIE=true`، `SESSION_DRIVER=database`، `CACHE_STORE=database` و `QUEUE_CONNECTION=database` داشته باشد. مقدار broadcasting و credentialها با محیط فعلی و artifact هماهنگ باشد؛ تغییر سرویس broadcasting جزو این اصلاح نیست.
4. فقط migrationهای تأییدشده در backup/staging را اجرا کنید:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan schedule:list
```

5. نگاشت document root و مسیر private subtitle را کنترل کنید. OPcache را طبق بخش بعد تأیید کنید؛ سپس:

```bash
php artisan up
```

6. پس از smoke موفق، SHA واقعی کد و checksum artifact را در رکورد خصوصی انتشار ثبت کنید. اگر کد از Git deploy شده، `git rev-parse HEAD` باید SHA هدف باشد؛ HEAD فایل ZIP یا تغییرات commitنشده را اثبات نمی‌کند. رکورد باید نام artifact و سلامت smoke را هم داشته باشد.

## OPcache؛ بدون endpoint عمومی

ممیزی قبلی فایل تولیدی و خارج از Gitِ `/home/zizolear/public_html/tamasharoom/public/clear-opcache.php` را یافت که بدون احراز هویت `opcache_reset()` فراخوانی می‌کند. برای اجرای برنامه لازم نیست و پاک‌سازی cache به درخواست ناشناس می‌تواند به مصرف CPU/اختلال منجر شود.

**اقدام تولیدِ جداگانه و هنوز انجام‌نشده:** پس از مجوز استقرار، اپراتور فقط همان فایل را از ریشه وب تماشاروم خارج کند؛ قبل از حذف، فهرست و نسخه خصوصی آن ثبت شود. هرگز URL را برای تست یا پاک‌کردن cache صدا نزنید. هیچ endpoint جایگزین HTTP نسازید.

`opcache_reset()` در PHP CLI الزاماً cache مربوط به PHP وب را پاک نمی‌کند. رفتار واقعی web SAPI، `opcache.validate_timestamps` و فاصله revalidate باید با ابزار خصوصی میزبان بررسی شود. اگر بازبینی timestamp فعال است، فرصت بازبینی و مشاهده نسخه جدید کافی است. اگر غیرفعال است، روش پشتیبانی میزبان برای invalidation فایل‌های همین برنامه یا reload اختصاصی همین سایت لازم است. اگر تنها reload مشترک حساب وجود دارد، این انتشار نباید خودسرانه زیزولرن را restart کند؛ پیش از انتشار هماهنگی مستقل لازم است. هیچ phpinfo یا ابزار reset عمومی آپلود نکنید.

## Cron، شبکه و پایش

cron هر دقیقه موجود را حفظ کنید؛ تکراری نسازید:

```text
* * * * * php /home/zizolear/public_html/tamasharoom/artisan schedule:run >> /dev/null 2>&1
```

`schedule:list` باید queue، presence، prune، Pusher usage، integrity و backup را نشان دهد. صف با `--stop-when-empty --max-time=30` تخلیه می‌شود؛ daemon لازم نیست. Pusher monitoring یک تلاش در هر نوبت مجاز انجام می‌دهد؛ بعد از خطا backoff برابر ۵، ۱۰، ۲۰، ۴۰ و حداکثر ۶۰ دقیقه دارد و موفقیت آن را صفر می‌کند. این backoff فقط برای monitoring است، نه broadcasting. DNS timeout میزبان با تغییر برنامه اثباتاً برطرف نشده؛ از مسیر پشتیبانی میزبان بررسی شود.

رله ویدیو به cURL برای probe و HTTP/TLS stream برای انتقال نیاز دارد. انتخاب IP مقصد و Host/SNI را با دامنه عمومی کنترل‌شده در staging تأیید کنید؛ هر hop دوباره اعتبارسنجی می‌شود. مدت استریم به `max_execution_time`، `set_time_limit` و سیاست میزبان وابسته است؛ تنظیم عمومی حساب را برای حل آن تغییر ندهید.

Cloudflare Speed Brain خاموش بماند؛ هدر `Speculation-Rules: "/speculation-rules"` و پاسخ خالی قوانین را کنترل کنید. مسیرهای hashدار build تغییرناپذیرند؛ purge محدود مسیرهای همان دامنه در صورت نیاز کافی است، نه تغییر حساب مشترک.

## Smoke و معیار توقف

- صفحه نخست و login با HTTPS، بدون خطای JS، asset 404 یا manifest mismatch؛ canonical/OG از APP_URL صحیح.
- ورود در دو تب و پاسخ polling دیررس: نشست سالم باقی بماند.
- پاسخ‌های پس‌زمینه اتاق، کوکی session یا XSRF را تمدید نمی‌کنند؛ تمدید عادی در ورود/ناوبری صفحه باقی است. تماشای بدون ناوبری بیش از `SESSION_LIFETIME` را در staging بررسی کنید؛ این اصلاح مهلت امنیتی نشست را افزایش نمی‌دهد.
- با کاربران آزمایشی مجاز: owner منبع را تغییر دهد؛ member/guest فقط play/pause/seek کند و payload منبع در sync، حتی null، با 422 رد شود؛ فرد خارج اتاق دسترسی نگیرد.
- پخش مستقیم و proxy، Range/seek و ادامه پخش با لینک عمومی مجاز؛ SSRF را روی تولید امتحان نکنید.
- دو بار زیرنویس هم‌نام بدون overwrite، فقط دسترسی اعضا، حذف track و فایل متعلق به آن.
- پیام/presence و پخش با دو مرورگر، Pusher واقعی و fallback مورد انتظار؛ health عمومی فقط مکمل است.
- بررسی logهای daily و pusher، queue failures، مصرف CPU/ورودی پردازش و فضای دیسک؛ monitoring خطادار به معنای اثبات شکست همه broadcastها نیست.
- Sentry در ممیزی قبلی DSN نداشت؛ در صورت نیاز تنظیم و تست مستقل با مجوز انجام شود. داده/توکن در گزارش smoke منتشر نشود.

هر 500، افزایش 401 ناخواسته، اشتباه مسیر، آسیب به فایل پایدار، دارایی مفقود یا عقب‌ماندن پخش معیار توقف است.

## بازگشت

در نگهداری بمانید یا همان برنامه را مجدداً down کنید. SHA و lockfile قبلی را همراه با **manifest و build همان نسخه** برگردانید، Composer را از همان lockfile نصب کنید، کش‌های config/route/view را بازتولید و OPcache وب را به روش خصوصی بررسی کنید؛ سپس up و smoke.

اگر migration ناسازگار با نسخه قبلی اجرا شده، بازگشت کد به‌تنهایی کافی نیست. بازگردانی فقط دیتابیس تماشاروم از بکاپ آزموده‌شده یا migration اصلاحی بازبینی‌شده لازم است؛ از `migrate:rollback` نامحدود استفاده نکنید. restore داده‌های جدید پس از بکاپ را از دست می‌دهد و نیازمند تصمیم صریح اپراتور است. session/queue/cache و فایل‌های خصوصی تازه را کورکورانه با نسخه قدیمی جایگزین نکنید. هیچ backup یا restore کل حساب مشترک در این روند مجاز نیست.
