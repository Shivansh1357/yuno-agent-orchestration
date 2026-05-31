"""Record a complete product demo video of the Yuno platform with Playwright,
then it's converted to a GIF by ffmpeg (see the surrounding shell command).

Flow: Monitor (trigger a live multi-agent run + watch the feed stream) →
Agents → Workflows (open the visual builder) → Chat (send a message, see the
Markdown-rendered reply). Records the whole session to webm.
"""
import asyncio
import os

BASE = os.environ.get("DEMO_BASE", "http://localhost:8030")
OUT = os.environ.get("DEMO_OUT", "/Users/shivansh/Projects/Yuno/demo-video")


async def main():
    from playwright.async_api import async_playwright

    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900},
            record_video_dir=OUT,
            record_video_size={"width": 1440, "height": 900},
            device_scale_factor=2,
        )
        page = await ctx.new_page()

        # 1) Monitor — connect, then trigger a real multi-agent run via the API
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.wait_for_timeout(2500)
        wf = await page.evaluate(
            "fetch('/api/workflows').then(r=>r.json()).then(w=>w.find(x=>x.name==='Support Triage'))"
        )
        await page.evaluate(
            """(id)=>fetch('/api/runs',{method:'POST',headers:{'content-type':'application/json'},
               body:JSON.stringify({workflow_id:id,input:'I was double-charged for my subscription and need a refund.'})})""",
            wf["id"],
        )
        await page.wait_for_timeout(13000)  # watch the live feed stream agent events

        # 2) Agents — config cards animate in
        await page.get_by_role("link", name="Agents").click()
        await page.wait_for_timeout(4000)

        # 3) Workflows — open the visual builder
        await page.get_by_role("link", name="Workflows").click()
        await page.wait_for_timeout(2500)
        try:
            await page.get_by_role("button", name="Open builder").first.click()
            await page.wait_for_timeout(5000)
        except Exception:
            await page.wait_for_timeout(3000)

        # 4) Chat — send a message, see the Markdown-rendered reply
        await page.get_by_role("link", name="Chat").click()
        await page.wait_for_timeout(2000)
        box = page.get_by_placeholder("Message the agent…")
        await box.click()
        await box.fill("Give me 3 quick productivity tips with a short bold label each, as a bulleted list.")
        await box.press("Enter")
        await page.wait_for_timeout(10000)

        await ctx.close()
        await browser.close()
        print("video dir:", OUT)


asyncio.run(main())
