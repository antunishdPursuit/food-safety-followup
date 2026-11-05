# Repository guidance

Build and commit one independently verifiable user outcome at a time. For this frontend, treat the location map/list, location review, record comparison, and follow-up workflow as separate checkpoints when each can be made usable and checked on its own. Combine changes only when they must land together for a working checkpoint.

Before each commit, run the checks relevant to that outcome, inspect Git status and existing staged changes, stage only its exact files or hunks, and review the staged diff. Commit the verified checkpoint before starting the next independent outcome. Do not collect several completed screens into one end-of-task commit or make broken placeholder commits to create artificial separation.

Keep private project records, credentials, local machine instructions, and unrelated changes out of commits. Pushes, merges, deployments, and history rewrites require matching authorization.
