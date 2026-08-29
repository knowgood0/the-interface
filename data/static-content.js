// These are real starting drafts, not placeholder lorem ipsum — but every
// bracketed [FIELD] must be filled in with accurate information before this
// site goes live. AdSense reviewers and users both check these pages, and
// generic or fake policy pages are a common rejection reason.

export const aboutHtml = ({ siteName }) => `
  <p><strong>${siteName}</strong> covers AI and technology in plain language — what tools are actually good for, how the underlying concepts work, and what's happening in the industry behind the headlines.</p>
  <p>We started this because most tech coverage falls into one of two traps: uncritical hype dressed up as news, or jargon-heavy explainers written for people who already understand the topic. We try to write for someone who's curious, busy, and wants a straight answer.</p>
  <h2>What we cover</h2>
  <ul>
    <li>Hands-on coverage of AI tools and products</li>
    <li>Plain-language explainers of technical concepts</li>
    <li>Industry and business developments in tech</li>
    <li>Practical, step-by-step guides</li>
  </ul>
  <h2>How we work</h2>
  <p>[FILL IN: describe your actual editorial process — how articles are researched, who writes and reviews them, and how AI assistance is or isn't used in drafting. See the Editorial Policy page for the full standard.]</p>
`;

export const contactHtml = () => `
  <p>Have a tip, correction, or question? We'd like to hear it.</p>
  <p>Email: <a href="mailto:[FILL IN CONTACT EMAIL]">[FILL IN CONTACT EMAIL]</a></p>
  <p>For press or advertising inquiries: <a href="mailto:[FILL IN BUSINESS EMAIL]">[FILL IN BUSINESS EMAIL]</a></p>
`;

export const editorialPolicyHtml = ({ siteName }) => `
  <h2>Original reporting and analysis</h2>
  <p>${siteName} does not republish or lightly rewrite articles from other outlets. When we cover a story that's also being reported elsewhere, we read multiple sources, verify claims where possible, and write our own analysis or explanation rather than summarizing someone else's article.</p>
  <h2>Sourcing</h2>
  <p>Where an article relies on a specific claim, statistic, or quote, we link to the original source. We do not fabricate quotes, statistics, or attributions.</p>
  <h2>Use of AI in our editorial process</h2>
  <p>We use AI tools to assist with research summarization, drafting, and SEO suggestions. Every article is reviewed and edited by a named human editor before publication — nothing is published automatically without human review. We do not publish content whose primary purpose is to rank for keywords rather than inform a reader.</p>
  <h2>Corrections</h2>
  <p>See our <a href="/corrections">Corrections Policy</a> for how we handle and disclose errors.</p>
  <h2>Author identification</h2>
  <p>Every article is attributed to a named author with a public bio. We do not publish under fabricated bylines or invented credentials.</p>
`;

export const correctionsHtml = ({ siteName }) => `
  <p>${siteName} corrects errors of fact promptly. If you believe an article contains an error, email <a href="mailto:[FILL IN CONTACT EMAIL]">[FILL IN CONTACT EMAIL]</a> with the article link and a description of the issue.</p>
  <p>Substantive corrections are noted at the bottom of the corrected article along with the date of the correction. Minor edits (typos, formatting) are made without a formal correction note.</p>
`;

export const advertisingDisclosureHtml = ({ siteName }) => `
  <p>${siteName} is supported by advertising. We may display ads served by Google AdSense or other advertising networks. These networks may use cookies to serve ads based on your prior visits to this and other websites.</p>
  <p>Any sponsored content or affiliate links will be clearly labeled as such at the point they appear. We do not accept payment in exchange for favorable coverage, and advertisers have no editorial input into our content.</p>
  <p>[FILL IN if/when affiliate programs are added: list which programs, e.g. "As an Amazon Associate we earn from qualifying purchases."]</p>
`;

export const privacyHtml = ({ siteName, domain }) => `
  <p><em>Last updated: [FILL IN DATE]</em></p>
  <p>This policy describes how ${siteName} (${domain}) collects and uses information when you visit this site.</p>
  <h2>Information we collect</h2>
  <ul>
    <li><strong>Analytics:</strong> We log basic pageview data (page visited, referring site, approximate traffic source, browser user agent) to understand what content is working. We do not sell this data.</li>
    <li><strong>Newsletter:</strong> If you subscribe, we collect your email address to send our newsletter. [FILL IN: name of email service provider once selected, e.g. "via ConvertKit."] You can unsubscribe at any time via the link in any email.</li>
    <li><strong>Advertising cookies:</strong> If advertising is enabled on this site, our ad partners (e.g. Google AdSense) may set cookies to serve relevant ads. [FILL IN once AdSense is active: link to Google's own policy at https://policies.google.com/technologies/ads.]</li>
  </ul>
  <h2>Your choices</h2>
  <p>You can opt out of personalized advertising through <a href="https://adssettings.google.com" rel="nofollow">Google Ads Settings</a> and through your browser's cookie controls.</p>
  <h2>Contact</h2>
  <p>Questions about this policy: <a href="mailto:[FILL IN CONTACT EMAIL]">[FILL IN CONTACT EMAIL]</a></p>
`;

export const termsHtml = ({ siteName }) => `
  <p><em>Last updated: [FILL IN DATE]</em></p>
  <p>By using ${siteName}, you agree to the following terms.</p>
  <h2>Content</h2>
  <p>Articles on this site reflect our editorial judgment at the time of publication and may be updated. Content is provided for informational purposes and is not professional financial, legal, or medical advice.</p>
  <h2>Intellectual property</h2>
  <p>Content on this site is owned by ${siteName} unless otherwise credited. You may share links and brief excerpts with attribution; you may not republish full articles without permission.</p>
  <h2>Limitation of liability</h2>
  <p>[FILL IN with counsel review before launch — this is a starting draft, not legal advice.]</p>
`;
