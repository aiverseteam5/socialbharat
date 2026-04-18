## RLS Cross-Tenant Isolation Test

**Run:** 2026-04-18T16:19:38.458Z **Supabase:** https://emmsllhglilcsucxhkby.supabase.co
**Overall: PASS** (6 passed, 0 failed)

| Check                                                 | Result  | Detail |
| ----------------------------------------------------- | ------- | ------ |
| User B sign-in                                        | ✅ PASS |        |
| posts: org A rows invisible to user B                 | ✅ PASS | 0 rows |
| conversations: org A rows invisible to user B         | ✅ PASS | 0 rows |
| social_profiles: org A rows invisible to user B       | ✅ PASS | 0 rows |
| invoices: org A rows invisible to user B              | ✅ PASS | 0 rows |
| user B can read own org_members row (RLS allows self) | ✅ PASS |        |

RLS isolation confirmed: user B cannot read user A's org data across all tested tables.
