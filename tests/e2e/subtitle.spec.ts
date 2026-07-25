import { test, expect, type Page } from "@playwright/test";

async function getXsrfToken(page: Page): Promise<string | undefined> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "XSRF-TOKEN")?.value;
}

test.describe("Subtitle upload and cue retrieval", () => {
  test("Upload VTT subtitle and retrieve cues", async ({ page }) => {
    test.setTimeout(20000);

    const resp = await page.request.post("/__test/setup-verified-room", {
      data: { with_video: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);
    const headers = xsrf ? { "X-XSRF-TOKEN": xsrf } : {};

    // Upload a VTT subtitle file
    const vttContent = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
زیرنویس فارسی تست

2
00:00:06.000 --> 00:00:10.000
Second cue in English`;

    const uploadResp = await page.request.post(`/subtitles/${room_id}`, {
      multipart: {
        file: {
          name: "test.vtt",
          mimeType: "text/vtt",
          buffer: Buffer.from(vttContent),
        },
        label: "فارسی",
        language: "fa",
      },
      headers,
    });
    expect(uploadResp.ok()).toBeTruthy();
    const track = await uploadResp.json();
    expect(track.label).toBe("فارسی");

    // List subtitle tracks
    const tracksResp = await page.request.get(`/subtitles/${room_id}`, {
      headers,
    });
    expect(tracksResp.ok()).toBeTruthy();
    const tracks = await tracksResp.json();
    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe(track.id);

    // Retrieve cues
    const cuesResp = await page.request.get(`/subtitles/${room_id}/${track.id}/cues`, {
      headers,
    });
    expect(cuesResp.ok()).toBeTruthy();
    const cues = await cuesResp.json();
    expect(cues.length).toBe(2);
    expect(cues[0].text).toContain("زیرنویس فارسی تست");
    expect(cues[0].start).toBe(1000);
    expect(cues[0].end).toBe(5000);
  });

  test("Upload SRT subtitle and retrieve converted cues", async ({ page }) => {
    test.setTimeout(20000);

    const resp = await page.request.post("/__test/setup-verified-room", {
      data: { with_video: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);
    const headers = xsrf ? { "X-XSRF-TOKEN": xsrf } : {};

    // Upload an SRT subtitle file
    const srtContent = `1
00:00:02.000 --> 00:00:06.000
First SRT cue

2
00:00:07.500 --> 00:00:12.000
Second SRT cue with طولانی`;

    const uploadResp = await page.request.post(`/subtitles/${room_id}`, {
      multipart: {
        file: {
          name: "test.srt",
          mimeType: "text/plain",
          buffer: Buffer.from(srtContent),
        },
        label: "SRT Test",
        language: "en",
      },
      headers,
    });
    expect(uploadResp.ok()).toBeTruthy();
    const track = await uploadResp.json();
    expect(track.original_extension).toBe("srt");

    // Retrieve cues (converted from SRT to VTT)
    const cuesResp = await page.request.get(`/subtitles/${room_id}/${track.id}/cues`, {
      headers,
    });
    expect(cuesResp.ok()).toBeTruthy();
    const cues = await cuesResp.json();
    expect(cues.length).toBe(2);
    expect(cues[0].start).toBe(2000);
    expect(cues[0].end).toBe(6000);
    expect(cues[1].text).toContain("طولانی");
  });

  test("Delete subtitle track", async ({ page }) => {
    test.setTimeout(20000);

    const resp = await page.request.post("/__test/setup-verified-room", {
      data: { with_video: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);
    const headers = xsrf ? { "X-XSRF-TOKEN": xsrf } : {};

    // Upload a subtitle
    const uploadResp = await page.request.post(`/subtitles/${room_id}`, {
      multipart: {
        file: {
          name: "delete-test.vtt",
          mimeType: "text/vtt",
          buffer: Buffer.from("WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nDelete me"),
        },
      },
      headers,
    });
    expect(uploadResp.ok()).toBeTruthy();
    const track = await uploadResp.json();

    // Delete it
    const delResp = await page.request.delete(`/subtitles/${room_id}/${track.id}`, {
      headers,
    });
    expect(delResp.ok()).toBeTruthy();

    // Verify track list is empty
    const tracksResp = await page.request.get(`/subtitles/${room_id}`, {
      headers,
    });
    expect(tracksResp.ok()).toBeTruthy();
    const tracks = await tracksResp.json();
    expect(tracks.length).toBe(0);
  });
});
