import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Step 1: Go to the homepage
        page.goto("http://localhost:3002/")

        # Step 2: Navigate to Morning Check-in
        # Using a more specific locator to ensure we click the right card
        morning_card_link = page.locator("a[href='/check-in/morning']")
        expect(morning_card_link).to_be_visible()
        morning_card_link.click()

        # Step 3: Fill out the morning form
        expect(page).to_have_url(re.compile(r".*/check-in/morning"))
        page.get_by_label("What is your main intention for today?").fill("My main intention is to finish this task.")
        page.get_by_label("What's one thing you're worried about?").fill("I'm worried about edge cases.")
        page.get_by_label("What's one thing you're looking forward to?").fill("I'm looking forward to submitting this change.")
        page.get_by_role("button", name="Set Intentions").click()

        # Step 4: Verify redirect and countdown on homepage
        expect(page).to_have_url("http://localhost:3000/")

        # Now the evening card should be visible and counting down
        evening_card_title = page.get_by_role("heading", name="Daily Review")
        expect(evening_card_title).to_be_visible()

        # The description should now be a countdown timer
        # We'll look for a pattern like "Available in HH:MM:SS"
        # Since the exact time is dynamic, we use a regex
        countdown_text = page.locator("p:has-text('Available in')")
        expect(countdown_text).to_be_visible()

        # Take a screenshot of the homepage with the countdown
        page.screenshot(path="jules-scratch/verification/01_morning_complete_countdown.png")
        print("Successfully took screenshot of the morning-complete state.")

        # Step 5: Manually set the check-in to be ready for evening
        # In a real test, we might use page.evaluate or an API call to update the state.
        # For this verification, we assume the countdown has finished and the card is clickable.
        # Let's just navigate directly to the evening page.
        page.goto("http://localhost:3000/check-in/evening")

        # Step 6: Fill out the evening form
        expect(page).to_have_url(re.compile(r".*/check-in/evening"))
        expect(page.get_by_text("This morning, your intention was:")).to_be_visible()
        page.get_by_label("How did that go?").fill("It went well, I'm almost done.")
        page.get_by_label("How are you feeling about that now?").fill("Less worried, it was manageable.")
        page.get_by_label("How was it?").fill("It was very satisfying!")
        page.get_by_label("What's one thing you're grateful for today?").fill("I'm grateful for the opportunity to learn.")
        page.get_by_role("button", name="Complete Review").click()

        # Step 7: Verify redirect and completed state on homepage
        expect(page).to_have_url("http://localhost:3000/")

        # Both cards should now show a completed state
        expect(page.locator("div.ring-green-500:has-text('Today\\'s Intentions')")).to_be_visible()
        expect(page.locator("div.ring-green-500:has-text('Daily Review')")).to_be_visible()

        # Take a screenshot of the final completed state
        page.screenshot(path="jules-scratch/verification/02_evening_complete.png")
        print("Successfully took screenshot of the evening-complete state.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
    finally:
        context.close()
        browser.close()

with sync_playwright() as p:
    run(p)
