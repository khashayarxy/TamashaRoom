<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\Room;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'max_members' => ['sometimes', 'integer', 'min:2', 'max:50'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $activeCount = Room::where('last_activity_at', '>', now()->subHours(2))
                ->count();

            $maxConcurrent = config('tamasharoom.max_concurrent_rooms', 50);

            if ($activeCount >= $maxConcurrent) {
                $validator->errors()->add('name', 'سرور در حال حاضر ظرفیت کامل دارد. لطفاً بعداً تلاش کنید.');
            }
        });
    }
}
