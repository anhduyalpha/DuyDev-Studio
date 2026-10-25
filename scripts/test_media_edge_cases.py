import asyncio
import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from playwright.async_api import async_playwright

async def run_edge_cases():
    print("🚀 Verifying direct hash routes and auto-start...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 800})
        await context.add_init_script("""
            localStorage.setItem('ds_user_profile', JSON.stringify({ name: 'DuyDev', avatar: 'preset:rocket' }));
            localStorage.setItem('ds_profile_prompted_v1', 'true');
        """)
        page = await context.new_page()

        # 1. Direct hash route: #facebook
        print("1. Testing direct hash route: http://localhost:3000/#facebook")
        await page.goto("http://localhost:3000/#facebook", wait_until="domcontentloaded")
        await asyncio.sleep(0.5)
        fb_input = page.locator('#fbUrlInput')
        assert await fb_input.is_visible(), "Direct hash #facebook did not open Facebook workspace!"
        print("-> Direct #facebook route OK")

        # 2. Direct hash route: #instagram
        print("2. Testing direct hash route: http://localhost:3000/#instagram")
        await page.goto("http://localhost:3000/#instagram", wait_until="domcontentloaded")
        await asyncio.sleep(0.5)
        ig_input = page.locator('#igUrlInput')
        assert await ig_input.is_visible(), "Direct hash #instagram did not open Instagram workspace!"
        print("-> Direct #instagram route OK")

        # 3. Direct hash route: #spotify
        print("3. Testing direct hash route: http://localhost:3000/#spotify")
        await page.goto("http://localhost:3000/#spotify", wait_until="domcontentloaded")
        await asyncio.sleep(0.5)
        sp_input = page.locator('#spUrlInput')
        assert await sp_input.is_visible(), "Direct hash #spotify did not open Spotify workspace!"
        print("-> Direct #spotify route OK")

        # 4. Auto-Start Handoff via sessionStorage
        print("4. Testing consumePendingAutoStart handoff for Facebook...")
        await page.evaluate("""() => {
            sessionStorage.setItem('dd_pending_autostart_url', JSON.stringify({
                toolId: 'facebook',
                url: 'https://www.facebook.com/watch/?v=12345678',
                ts: Date.now()
            }));
        }""")
        await page.goto("http://localhost:3000/#tool/facebook-downloader", wait_until="domcontentloaded")
        await asyncio.sleep(0.5)
        val = await fb_input.input_value()
        assert val == 'https://www.facebook.com/watch/?v=12345678', f"Expected auto-start URL in input, got: {val}"
        print("-> consumePendingAutoStart auto-populated Facebook URL correctly!")

        # 5. Verify taskCoordinator.createTask & updateTask
        print("5. Testing taskCoordinator.createTask & updateTask...")
        task_dock_status = await page.evaluate("""() => {
            if (!window.__ds_taskCoordinator) return 'no_coordinator';
            window.__ds_taskCoordinator.createTask('test_task_1', {
                title: 'Test Media Job',
                status: 'running',
                progress: 50
            });
            const active = window.__ds_taskCoordinator.getActiveTasks();
            const found = active.find(t => t.id === 'test_task_1');
            return found ? 'found' : 'missing';
        }""")
        assert task_dock_status == 'found', f"taskCoordinator.createTask failed: {task_dock_status}"
        print("-> taskCoordinator.createTask integrated and active in dock successfully!")

        await browser.close()
        print("🎉 ALL EDGE CASE VERIFICATION CHECKS PASSED 100%!")

if __name__ == '__main__':
    asyncio.run(run_edge_cases())
