<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlaybackRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'is_playing' => ['required', 'boolean'],
            'position_seconds' => ['required', 'numeric', 'min:0', 'max:86400'],
            'duration_seconds' => ['required', 'numeric', 'min:0', 'max:86400'],
            'playback_rate' => ['sometimes', 'numeric', 'min:0.25', 'max:4'],
            'video_url' => ['sometimes', 'nullable', 'url'],
            'client_timestamp' => ['sometimes', 'numeric'],
        ];
    }
}
