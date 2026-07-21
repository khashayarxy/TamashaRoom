<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class JoinRoomRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'invite_code' => ['required', 'string', 'exists:rooms,invite_code'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'invite_code' => $this->route('inviteCode'),
        ]);
    }
}
