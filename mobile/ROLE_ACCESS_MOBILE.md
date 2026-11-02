# Mobile access by farm role

Mobile operational screens are for members with the EMPLOYEE role in the selected farm. A member with both EMPLOYEE and a management role can use the employee workflow, but approval and management actions remain on web.

- Employees can scan QR codes, look up inventory and assets, create stock documents and counts, and report maintenance incidents. Maintenance reports create requests for web approval.
- Other roles can sign in, switch farms, view account information and sign out. The dashboard directs them to web. Warehouse, asset, activity and notification routes are protected for employees.
- Management on web includes stock document approval, maintenance and transfer request approval, maintenance scheduling, asset return and material creation.
- The API remains authoritative for every write; mobile route checks provide the matching user interface boundary.

Verify with real Clerk accounts for EMPLOYEE, management-only roles, STORE_MANAGER, GUEST, and mixed-role memberships. Check direct links and push taps after a farm or role change.
