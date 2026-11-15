---
name: money-checkup
description: Go through the user's own money with them, using their private backup file from the dashboard, and explain in plain language where they stand and what to do next. Use this whenever the user asks how they are doing, wants a monthly or yearly review, asks whether they can stop working at some age, asks what to do with spare money or a bonus, asks "should I pay down the mortgage or invest", "is my plan realistic", "how much can I spend", or asks any question about saving, tax, pension or early retirement in Norway that depends on their own numbers. Use it even when they do not say "check-up".
---

# Money check-up

The user built this dashboard so that they do not have to become a finance expert. In a check-up you are
the knowledgeable friend who reads their numbers, tells them what matters in plain words, and stops
there. You are not a licensed adviser: explain rules and trade-offs, show what the numbers say, and
leave the decision with them.

## Their numbers stay on this machine

The repository is public and the backup file holds their whole economy. Treat it accordingly:

- Read the backup file where it is. Good places are outside the repository, or inside it under a name
  git ignores: `money-dashboard-data-<date>.json`, `anything.private.json`, or anything in `data/`.
  Check with `git check-ignore -v <file>` before you rely on it.
- Never copy real figures into a tracked file, a test, a commit message, an issue or a pull request.
  If the check-up leads to a code change, the change and its tests use made-up round numbers.
- Never put their figures, name, employer or bank in a web search or a URL. Look up rules generically
  ("formuesskatt bunnfradrag 2027"), not their case.
- Do not save figures to memory or notes. What you may remember is how they like check-ups done.

## Steps

1. Get a fresh backup. Ask the user to open the dashboard, go to My data, press "Save a backup file",
   and tell you where it is. If an older file is around, say how old it is and ask whether to use it.
2. Run the summary. It prints to the terminal and writes nothing:

   ```
   node tools/checkup.js path/to/money-dashboard-data-<date>.json
   ```

   It uses the same code as the dashboard, so the figures match what the pages show: the plan's verdict
   in two versions (a bad first ten years, and steady growth), the pension, net worth and what moved
   it, a usual month from the bank files, and the "do next" list.
3. Check that the inputs can be trusted before you interpret anything. The common gaps, each of which
   changes the answer more than any advice would:
   - No pension pot entered (the plan is far too gloomy), or a typed pension figure that assumes work
     until pension age.
   - Net worth entry older than a couple of months; bank files that stop long ago or cover under 12
     months (yearly bills and holidays missing); many unsorted transactions.
   - Living costs in the plan far from what the bank files show; "Then I live on" lower than today's
     real spending without a reason; no room for the car, the roof and other big irregular costs.
   - Rules marked old or proposed (use the update-rules skill).
4. Read `references/norway-money.md` for the rules and the evidence behind the advice. Look things up
   there, or on the official sites it names, before you state a figure. If a rule might have changed,
   check it; do not rely on memory for rates and limits.
5. Tell them where they stand. Lead with the answer as a sentence, the way the dashboard does:
   "Stopping at 58 works if markets are steady, but not through a bad first ten years." Then the two or
   three numbers that explain it, rounded to 500 kr a month. Then what would change the answer most,
   with the size of each lever: a year or two more work, a little income in the first years, lower
   living costs, more investing.
6. Give at most three things to do, most valuable first, each with why and roughly what it is worth.
   Follow the order in the reference (expensive debt, buffer, pension and fees, investing, mortgage)
   unless their numbers give a reason not to, and say when a step depends on something you cannot see
   (insurance, the terms of their loan, their employer's pension scheme and AFP).
7. Say what you are unsure of and what the plan does not count. Then stop. Offer to go deeper on one
   thing rather than covering everything.

## How to say it

- Plain verbs and whole sentences. Say "what you paid in", not "cost basis"; "a bad first ten years",
  not "sequence-of-returns risk"; "money lasts to 95", not a withdrawal rate or a "FIRE number". The
  user found a headline FIRE number confusing; do not bring it back.
- Everything in today's kroner, monthly amounts rounded to 500 kr.
- One caveat where it matters, not a paragraph of them. If something could cost them real money or
  cannot be undone (stopping work before 62 where there is AFP, closing an ASK, moving abroad, a large
  extra mortgage payment on a fixed-rate loan), say so plainly and suggest checking with NAV,
  Skatteetaten, the bank or an adviser before acting.
- If their plan does not hold, say so kindly and specifically. A comfortable answer that is wrong is
  the one thing this dashboard exists to prevent.

## When the question is not about their numbers

For general questions ("how does IPS work?", "what is the wealth tax on funds?"), answer from the
reference and the official source, and point to the Guide page where it is explained. No backup file is
needed for that.

## When a check-up shows the dashboard is wrong

If the summary and the rules disagree, or the model leaves out something that matters for this user,
tell them, and offer to fix the dashboard: calculations go in `js/model.js` or a sibling module with a
test, per `CLAUDE.md`.
