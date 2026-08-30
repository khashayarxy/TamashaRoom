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

    // Upload a VTT subtitle file
    const vttContent = `WEBVTT

1
00:00:01.000 --> 00:00:05.000
زیرنویس فارسی تست

2
00:00:06.000 --> 00:00:10.000
Second cue in English`;

    const uploadResp = await page.evaluate(async ({ roomId, token, vttContent }) => {
      const formData = new FormData();
      formData.append("_token", token);
      formData.append("file", new Blob([vttContent], { type: "text/vtt" }), "test.vtt");
      formData.append("label", "فارسی");
      formData.append("language", "fa");
      const resp = await fetch(`/subtitles/${roomId}`, {
        method: "POST",
        body: formData,
      });
      return { status: resp.status, body: await resp.text() };
    }, { roomId: room_id, token: xsrf, vttContent });
    expect(uploadResp.status).toBe(201);
    const track = JSON.parse(uploadResp.body);
    expect(track.label).toBe("فارسی");

    // List subtitle tracks
    const tracksResp = await page.request.get(`/subtitles/${room_id}`);
    expect(tracksResp.ok()).toBeTruthy();
    const tracks = await tracksResp.json();
    expect(tracks.length).toBe(1);
    expect(tracks[0].id).toBe(track.id);

    // Retrieve cues
    const cuesResp = await page.request.get(`/subtitles/${room_id}/${track.id}/cues`);
    expect(cuesResp.ok()).toBeTruthy();
    const cuesData = await cuesResp.json();
    expect(cuesData.cues.length).toBe(2);
    expect(cuesData.cues[0].text).toContain("زیرنویس فارسی تست");
    expect(cuesData.cues[0].start).toBe(1000);
    expect(cuesData.cues[0].end).toBe(5000);
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

    // Upload an SRT subtitle file
    const srtContent = `1
00:00:02.000 --> 00:00:06.000
First SRT cue

2
00:00:07.500 --> 00:00:12.000
Second SRT cue with طولانی`;

    const uploadResp = await page.evaluate(async ({ roomId, token, srtContent }) => {
      const formData = new FormData();
      formData.append("_token", token);
      formData.append("file", new Blob([srtContent], { type: "application/x-subrip" }), "test.srt");
      formData.append("label", "SRT Test");
      formData.append("language", "en");
      const resp = await fetch(`/subtitles/${roomId}`, {
        method: "POST",
        body: formData,
      });
      return { status: resp.status, body: await resp.text() };
    }, { roomId: room_id, token: xsrf, srtContent });
    expect(uploadResp.status).toBe(201);
    const track = JSON.parse(uploadResp.body);
    expect(track.original_extension).toBe("srt");

    // Retrieve cues (converted from SRT to VTT)
    const cuesResp = await page.request.get(`/subtitles/${room_id}/${track.id}/cues`);
    expect(cuesResp.ok()).toBeTruthy();
    const cuesData = await cuesResp.json();
    expect(cuesData.cues.length).toBe(2);
    expect(cuesData.cues[0].start).toBe(2000);
    expect(cuesData.cues[0].end).toBe(6000);
    expect(cuesData.cues[1].text).toContain("طولانی");
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

    // Upload a subtitle
    const uploadResp = await page.evaluate(async ({ roomId, token }) => {
      const formData = new FormData();
      formData.append("_token", token);
      formData.append("file", new Blob(["WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nDelete me"], { type: "text/vtt" }), "delete-test.vtt");
      const resp = await fetch(`/subtitles/${roomId}`, {
        method: "POST",
        body: formData,
      });
      return { status: resp.status, body: await resp.text() };
    }, { roomId: room_id, token: xsrf });
    expect(uploadResp.status).toBe(201);
    const track = JSON.parse(uploadResp.body);

    // Delete it
    const delResp = await page.request.delete(`/subtitles/${room_id}/${track.id}`, {
      data: { _token: xsrf },
    });
    expect(delResp.ok()).toBeTruthy();

    // Verify track list is empty
    const tracksResp = await page.request.get(`/subtitles/${room_id}`);
    expect(tracksResp.ok()).toBeTruthy();
    const tracks = await tracksResp.json();
    expect(tracks.length).toBe(0);
  });

  test("Set and read room default subtitle", async ({ page, browser }) => {
    test.setTimeout(30000);

    const resp = await page.request.post("/__test/setup-verified-room", {
      data: { with_video: "1" },
    });
    expect(resp.ok()).toBeTruthy();
    const { room_url, room_id, invite_code } = await resp.json();

    await page.goto(room_url);
    await page.waitForLoadState("networkidle");

    const xsrf = await getXsrfToken(page);

    // Upload a subtitle to use as the default
    const uploadResp = await page.evaluate(async ({ roomId, token }) => {
      const formData = new FormData();
      formData.append("_token", token);
      formData.append("file", new Blob(["WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nDefault track"], { type: "text/vtt" }), "default-test.vtt");
      const resp = await fetch(`/subtitles/${roomId}`, {
        method: "POST",
        body: formData,
      });
      return { status: resp.status, body: await resp.text() };
    }, { roomId: room_id, token: xsrf });
    expect(uploadResp.status).toBe(201);
    const track = JSON.parse(uploadResp.body);

    // Set it as the room default
    const setResp = await page.request.post(`/subtitles/${room_id}/default`, {
      data: { _token: xsrf, track_id: track.id },
    });
    expect(setResp.ok()).toBeTruthy();
    const setBody = await setResp.json();
    expect(setBody.default_track_id).toBe(track.id);

    // Verify via the read endpoint as the owner
    const defaultResp = await page.request.get(`/subtitles/${room_id}/default`);
    expect(defaultResp.ok()).toBeTruthy();
    const defaultBody = await defaultResp.json();
    expect(defaultBody.default_track_id).toBe(track.id);

    // Member joins in a separate context and can read the room default
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    const joinResp = await memberPage.request.post("/__test/join-room", {
      data: { invite_code, force_new: true },
    });
    expect(joinResp.ok()).toBeTruthy();

    const memberDefaultResp = await memberPage.request.get(
      `/subtitles/${room_id}/default`,
    );
    expect(memberDefaultResp.ok()).toBeTruthy();
    const memberDefaultBody = await memberDefaultResp.json();
    expect(memberDefaultBody.default_track_id).toBe(track.id);

    // A member cannot set the room default (owner-only)
    const memberSetResp = await memberPage.request.post(
      `/subtitles/${room_id}/default`,
      { data: { _token: await getXsrfToken(memberPage), track_id: track.id } },
    );
    expect(memberSetResp.status()).toBe(403);

    await memberContext.close();

    // Delete the track; the room default must be cleared
    const delResp = await page.request.delete(`/subtitles/${room_id}/${track.id}`, {
      data: { _token: xsrf },
    });
    expect(delResp.ok()).toBeTruthy();

    const clearedResp = await page.request.get(`/subtitles/${room_id}/default`);
    expect(clearedResp.ok()).toBeTruthy();
    const clearedBody = await clearedResp.json();
    expect(clearedBody.default_track_id).toBeNull();
  });
});
