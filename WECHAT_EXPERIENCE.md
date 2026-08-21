# AthleteLog WeChat Experience Build

This folder contains a native WeChat Mini Program version of AthleteLog for small-circle experience testing.

## Included in this Lite build

- Today: protein and calorie totals, favorite and custom foods, water, streak, and period-day toggle.
- Gym: four training templates, custom exercises, sets/reps/weight, completion tracking, and recent sessions.
- Summary: seven-day overview, editable goals, JSON export/import, and local-data reset.
- Storage is local to each tester's WeChat installation. No API key is included and no account is required.

## Open it in WeChat DevTools

1. Install WeChat DevTools from the official WeChat Mini Program site.
2. Import this repository folder as a Mini Program project.
3. Replace `touristappid` in `project.config.json` with your Mini Program AppID.
4. Compile, test the three tabs, then use **Upload** in DevTools.
5. In the WeChat Mini Program admin console, select that uploaded build as the Experience Version and add tester WeChat IDs.

The Experience Version cannot be uploaded with `touristappid`; a registered Mini Program AppID and developer login are required for that final step.
