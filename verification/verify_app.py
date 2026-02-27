from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        print("Navigating to app...")
        page.goto("http://localhost:5173")
        # Wait a bit for potential redirects or loading
        page.wait_for_timeout(5000)

        # Take screenshot
        print("Taking screenshot...")
        page.screenshot(path="verification/app_screenshot.png")
        print("Screenshot saved.")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
