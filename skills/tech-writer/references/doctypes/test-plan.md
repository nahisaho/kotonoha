# Test plan type

A test plan defines how requirements and quality risks will be verified,
which environments and data are needed, and what evidence permits a release
or acceptance decision. It covers planning and traceability rather than
replacing executable test code.

## Target reader

Test leads, developers, product owners, business acceptance testers,
operators, security reviewers, and release approvers.

## Settle before writing

- The approved requirements and design baselines
- In-scope systems, environments, platforms, and quality attributes
- The highest-impact quality risks and required test levels
- Measurable entry, exit, and release criteria
- Environment, data, tooling, staffing, and schedule constraints
- Defect severity definitions and residual-risk approval authority

## Responsibility boundary

Define the verification strategy, cases, criteria, ownership, and evidence.
Keep detailed automation implementation in test code. A test plan must not
weaken an approved acceptance criterion; record conflicts as open issues and
resolve them through requirement change control.

## Template

Start from `assets/templates/test-plan.md`.
The template is the Japanese-language skeleton; translate its headings when
the target document is English.

## Recommended skeleton

1. Agreement target, baselines, scope, quality goals, and risks
2. Test levels, non-functional testing, environment, and data
3. Entry, exit, release, and residual-risk criteria
4. Requirement-to-test traceability and defect management
5. Schedule, ownership, evidence, risks, and approval

## Checklist

- [ ] Are the requirement and design baselines uniquely identified?
- [ ] Are scope, exclusions, environments, platforms, data, and production
      differences explicit?
- [ ] Does the strategy prioritize tests using concrete quality risks?
- [ ] Are functional and non-functional criteria measurable?
- [ ] Can every Must requirement and acceptance condition be traced to tests?
- [ ] Are entry, exit, defect, release, and residual-risk criteria objective?
- [ ] Are evidence storage, ownership, schedule, and approval defined?
- [ ] Are test-data privacy, cleanup, and environment reset covered?
