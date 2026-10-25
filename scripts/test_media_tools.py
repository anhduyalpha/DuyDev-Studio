import asyncio
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

async def run_browser_verification():
    os.makedirs('scratch/verification', exist_ok=True)
    print("🚀 Launching Playwright browser verification...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await context.add_init_script("""
            localStorage.setItem('ds_user_profile', JSON.stringify({ name: 'DuyDev', avatar: 'preset:rocket' }));
            localStorage.setItem('ds_profile_prompted_v1', 'true');
        """)
        page = await context.new_page()

        # 1. Open Dashboard
        print("1. Opening http://localhost:3000/# ...")
        await page.goto("http://localhost:3000/#", wait_until="domcontentloaded")
        await asyncio.sleep(1)

        # 2. Check Media Filter Tab
        media_tab = page.locator('button[data-category="media"]')
        is_media_tab_visible = await media_tab.is_visible()
        print(f"2. Media tab visible in Category bar: {is_media_tab_visible}")
        assert is_media_tab_visible, "Media tab button not found in Category filter bar!"

        # 3. Click Media Tab
        print("3. Clicking Media filter pill...")
        await media_tab.click()
        await asyncio.sleep(0.5)

        # Verify cards
        fb_card = page.locator('a[data-tool-id="facebook-downloader"]')
        ig_card = page.locator('a[data-tool-id="instagram-downloader"]')
        sp_card = page.locator('a[data-tool-id="spotify-downloader"]')

        has_fb = await fb_card.is_visible()
        has_ig = await ig_card.is_visible()
        has_sp = await sp_card.is_visible()
        print(f"-> FB card visible: {has_fb}")
        print(f"-> IG card visible: {has_ig}")
        print(f"-> Spotify card visible: {has_sp}")
        assert has_fb and has_ig and has_sp, "One or more media tool cards are missing!"

        await page.screenshot(path="scratch/verification/1_dashboard_media_tab.png")
        print("📸 Captured scratch/verification/1_dashboard_media_tab.png")

        # 4. Open Facebook Workspace
        print("4. Opening Facebook Downloader workspace...")
        await fb_card.click()
        await asyncio.sleep(0.8)
        fb_input = page.locator('#fbUrlInput')
        assert await fb_input.is_visible(), "Facebook URL input not visible!"
        await page.screenshot(path="scratch/verification/2_facebook_workspace.png")
        print("📸 Captured scratch/verification/2_facebook_workspace.png")

        # 5. Open Instagram Workspace
        print("5. Opening Instagram Downloader workspace...")
        await page.goto("http://localhost:3000/#tool/instagram-downloader", wait_until="domcontentloaded")
        await asyncio.sleep(0.8)
        ig_input = page.locator('#igUrlInput')
        assert await ig_input.is_visible(), "Instagram URL input not visible!"
        await page.screenshot(path="scratch/verification/3_instagram_workspace.png")
        print("📸 Captured scratch/verification/3_instagram_workspace.png")

        # 6. Open Spotify Workspace & Resolve Track
        print("6. Opening Spotify Downloader workspace...")
        await page.goto("http://localhost:3000/#tool/spotify-downloader", wait_until="domcontentloaded")
        await asyncio.sleep(0.8)
        sp_input = page.locator('#spUrlInput')
        assert await sp_input.is_visible(), "Spotify URL input not visible!"
        await page.screenshot(path="scratch/verification/4_spotify_workspace_empty.png")

        print("7. Testing track resolution in Spotify workspace...")
        await sp_input.fill("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT")
        resolve_btn = page.locator('button[data-action="resolve"]')
        await resolve_btn.click()

        # Wait for track card to appear
        track_title = page.locator('h2:has-text("Never Gonna Give You Up")')
        await track_title.wait_for(timeout=20000)
        assert await track_title.is_visible(), "Track title card not rendered!"
        print("-> Track resolved and rendered successfully in UI!")

        audio_el = page.locator('audio')
        assert await audio_el.is_visible(), "Audio player element not visible!"

        await page.screenshot(path="scratch/verification/5_spotify_workspace_resolved.png")
        print("📸 Captured scratch/verification/5_spotify_workspace_resolved.png")

        await browser.close()
        print("🎉 ALL BROWSER-USE VERIFICATION CHECKS PASSED 100%!")

if __name__ == '__main__':
    asyncio.run(run_browser_verification())
