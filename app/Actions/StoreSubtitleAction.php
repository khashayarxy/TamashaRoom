<?php

declare(strict_types=1);

namespace App\Actions;

use App\Models\Room;
use App\Models\SubtitleTrack;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use RuntimeException;
use Throwable;

class StoreSubtitleAction
{
    public function execute(Room $room, int $userId, string $label, string $language, string $extension, string $content): SubtitleTrack
    {
        $disk = Storage::disk('local');
        $path = sprintf('subtitles/%d/%s.vtt', $room->id, Str::uuid());

        try {
            if (! $disk->put($path, $content)) {
                throw new RuntimeException('Subtitle storage write failed.');
            }
        } catch (Throwable $exception) {
            $this->removePartialFile($path);
            report($exception);

            throw ValidationException::withMessages([
                'file' => 'ذخیره زیرنویس انجام نشد. لطفاً دوباره تلاش کنید.',
            ]);
        }

        try {
            return SubtitleTrack::create([
                'room_id' => $room->id,
                'user_id' => $userId,
                'label' => $label,
                'language' => $language,
                'file_path' => $path,
                'original_extension' => $extension,
            ]);
        } catch (Throwable $exception) {
            // Only this upload's unique path is owned by the failed operation.
            $this->removePartialFile($path);

            throw $exception;
        }
    }

    private function removePartialFile(string $path): void
    {
        try {
            if (! Storage::disk('local')->delete($path)) {
                report(new RuntimeException('Subtitle rollback cleanup failed.'));
            }
        } catch (Throwable $exception) {
            report($exception);
        }
    }
}
