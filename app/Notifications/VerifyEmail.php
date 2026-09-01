<?php

declare(strict_types=1);

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail as BaseVerifyEmail;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Persian-localized email verification notification.
 *
 * Extends the framework notification so the signed verification URL is
 * generated exactly as Laravel does by default — only the visible mail
 * content (subject/body/button label) is customized.
 */
class VerifyEmail extends BaseVerifyEmail
{
    /**
     * Build the mail representation of the notification.
     *
     * @param  mixed  $notifiable
     * @return MailMessage
     */
    public function toMail($notifiable)
    {
        $verificationUrl = $this->verificationUrl($notifiable);

        return (new MailMessage)
            ->subject('خوش آمدید به تماشاروم — تایید ایمیل')
            ->greeting('سلام '.$notifiable->name.' عزیز،')
            ->line('به تماشاروم خوش آمدید!')
            ->line('برای تکمیل ثبت‌نام، لطفاً روی دکمه‌ی زیر کلیک کنید:')
            ->action('تایید ایمیل', $verificationUrl)
            ->line('اگر شما این درخواست را ثبت نکرده‌اید، این ایمیل را نادیده بگیرید.')
            ->salutation('تیم تماشاروم');
    }
}
