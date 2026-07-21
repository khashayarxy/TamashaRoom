<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UploadSubtitleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:srt,vtt',
                'max:2048',
            ],
            'label' => ['sometimes', 'string', 'max:255'],
            'language' => ['sometimes', 'string', 'max:10'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $validator->errors()->has('file') && $this->hasFile('file')) {
                    $file = $this->file('file');
                    $content = $file->get();

                    if ($content === false || $content === '') {
                        $validator->errors()->add('file', 'File is empty or unreadable.');

                        return;
                    }

                    $extension = strtolower($file->getClientOriginalExtension());

                    $detected = $this->detectSubtitleFormat($content);

                    if ($detected === null || $detected !== $extension) {
                        $validator->errors()->add('file', 'File content does not match the expected subtitle format.');
                    }
                }
            },
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Please select a subtitle file.',
            'file.mimes' => 'Only SRT and VTT files are allowed.',
            'file.max' => 'File size must not exceed 2 MB.',
        ];
    }

    private function detectSubtitleFormat(string $content): ?string
    {
        $firstLine = strtok($content, "\r\n");

        if ($firstLine === false) {
            return null;
        }

        $trimmed = trim($firstLine);

        if (str_starts_with($trimmed, "\xEF\xBB\xBF")) {
            $trimmed = substr($trimmed, 3);
        }

        if (str_starts_with($trimmed, 'WEBVTT')) {
            return 'vtt';
        }

        if (preg_match('/^\d+$/', $trimmed)) {
            return 'srt';
        }

        return null;
    }
}
