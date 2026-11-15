---
name: money-checkup
description: Go through the user's own money with them, using a private copy of their numbers from the dashboard, and explain in plain language where they stand and what to do next. Use this whenever the user asks how they are doing, wants a monthly or yearly review, asks whether they can stop working at some age, asks what to do with spare money or a bonus, asks "should I pay down the mortgage or invest", "am I spending too much", "is my investing on track", or asks any question about saving, tax, pension or early retirement in Norway that depends on their own numbers. Use it even when they do not say "check-up".
---

# Money check-up

The user built this dashboard so that they do not have to become a finance expert. In a check-up you are
the knowledgeable friend who reads their numbers, tells them what matters in plain words, and stops
there. You are not a licensed adviser: explain rules and trade-offs, show what the numbers say, and
leave the decision with them.

## Their numbers stay on this machine

The repository is public and a copy of their numbers holds their whole economy. Treat it accordingly:

- Read the copy where it is. Good places are outside the repository, or inside it under a name git
  ignores: `money-dashboard-data-<date>.json`, `anything.private.json`, or anything in `data/`.
  Check with `git check-ignore -v <file>` before you rely on it. If they keep their numbers in a synced
  file (Data page), that file is a copy too.
- Never copy real figures into a tracked file, a test, a commit message, an issue or a pull request.
  If the check-up leads to a code change, the change and its tests use made-up round numbers.
- Never put their figures, name, employer or bank in a web search or a URL. Look up rules generically
  ("formuesskatt bunnfradrag 2027"), not their case.
- Do not save figures to memory or notes. What you may remember is how they like check-ups done.

## Steps

1. Get a fresh copy: the file their numbers are kept in, or Data > Save a copy. If an older file is
   around, say how old it is and ask whether to use it.
2. Run the summary. It prints to the terminal and writes nothing:

   ```
   node tools/checkup.js path/to/money-dashboard-data-<date>.json
   ```

   It uses the same code as the dashboard, so the figures match the pages: the usual month and its
   categories, net worth and what moved it, the rough age they can stop working (with 2% and 4% growth
   beside it), and the "Do next" list.
3. Check that the inputs can be trusted before you interpret anything. The common gaps, each of which
   changes the answer more than any advice would:
   - No pension typed (the age is far too late), or NAV's figure, which assumes work until the pension
     starts, used for someone who plans to stop much earlier.
   - No mortgage end year while the files show mortgage payments: the mortgage is then counted for life.
   - Values older than a couple of months; bank files that stop long ago or cover under 12 months
     (yearly bills and holidays missing); many unsorted lines; card bills that are large and opaque.
   - "Put in so far" missing or stale, which makes the tax on growth wrong.
4. Read `references/norway-money.md` for the rules and the evidence behind the advice. Look things up
   there, or on the official sites it names, before you state a figure. If a rule might have changed,
   check it; do not rely on memory for rates and limits.
5. Tell them where they stand. Lead with the answer as a sentence, the way the dashboard does:
   "At this pace you can stop at 58." Then the two or three numbers that explain it, rounded to 500 kr a
   month. Then what would change the answer most, with the size of each lever: investing more, living
   on less, a year or two more work, the mortgage gone sooner.
6. Give at most three things to do, most valuable first, each with why and roughly what it is worth.
   Follow the order in the reference (expensive debt, buffer, pension and fees, investing, mortgage)
   unless their numbers give a reason not to, and say when a step depends on something you cannot see
   (insurance, the terms of their loan, their employer's pension scheme and AFP).
7. Say what you are unsure of and what the dashboard does not count (wealth tax, AFP, a lower pension
   when stopping early). Then stop. Offer to go deeper on one thing rather than covering everything.

## How to say it

- Plain verbs and whole sentences. Say "what you put in", not "cost basis"; "a bad first ten years",
  not "sequence-of-returns risk"; "money lasts to 95", not a withdrawal rate or a "FIRE number". The
  user found a headline FIRE number confusing; do not bring it back.
- Everything in today's kroner, monthly amounts rounded to 500 kr.
- One caveat where it matters, not a paragraph of them. If something could cost them real money or
  cannot be undone (stopping work before 62 where there is AFP, closing an ASK, moving abroad, a large
  extra mortgage payment on a fixed-rate loan), say so plainly and suggest checking with NAV,
  Skatteetaten, the bank or an adviser before acting.
- If the answer is not what they hoped, say so kindly and specifically. A comfortable answer that is
  wrong is the one thing this dashboard exists to prevent.

## When the question is not about their numbers

For general questions ("how does IPS work?", "what is the wealth tax on funds?"), answer from the
reference and the official source. No copy of their numbers is needed for that.

## When a check-up shows the dashboard is wrong

If the summary and the rules disagree, or the model leaves out something that matters for this user,
tell them, and offer to fix the dashboard: calculations go in `js/model.js` or a sibling module with a
test, per `CLAUDE.md`. Keep the app small: a fix should not add pages or inputs without asking.
