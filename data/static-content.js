export const aboutHtml = ({ siteName }) => `
  <p><strong>${siteName}</strong> covers AI and technology in plain language — what tools are useful for, how the underlying concepts work, and what is happening in the industry behind the headlines.</p>
  <p>The goal is straightforward: useful information for readers who are curious, busy, and want a clear answer without unnecessary jargon or hype.</p>
  <h2>What we cover</h2>
  <ul>
    <li>AI tools and products</li>
    <li>Plain-language technology explainers</li>
    <li>Industry and business developments</li>
    <li>Practical step-by-step guides</li>
  </ul>
  <h2>How the site works</h2>
  <p>Topics are selected from current technology coverage and evergreen editorial themes. Articles are generated and assembled through an automated publishing pipeline, with source links and image attribution included when applicable.</p>
`;

export const contactHtml = ({ siteName }) => `
  <p>${siteName} is an online publication operated through an automated editorial workflow.</p>
  <p>For corrections or factual concerns, use the article's source links and send the relevant article URL and the specific claim that needs attention through the site's publishing contact channel.</p>
  <p>For general feedback, the publication's public social channels and RSS feed are the best ways to follow updates.</p>
`;

export const editorialPolicyHtml = ({ siteName }) => `
  <h2>Original writing</h2>
  <p>${siteName} publishes original articles based on public source material and editorial research. Source material is used to inform the article rather than copied or lightly rewritten.</p>
  <h2>Sourcing</h2>
  <p>Articles link to relevant source material when a specific announcement, claim, or report is central to the story. Claims that cannot be supported are omitted rather than presented as fact.</p>
  <h2>Automated publishing</h2>
  <p>The publication uses automated software to discover topics, draft articles, select supporting images, assemble pages, and publish updates. The system is designed to reject incomplete output and duplicate topics before publication.</p>
  <h2>Images</h2>
  <p>Article images are selected from sources that provide reusable licensing information. Image credits and source links are displayed with articles when available.</p>
  <h2>Corrections</h2>
  <p>See the Corrections Policy for how factual errors are handled.</p>
`;

export const correctionsHtml = ({ siteName }) => `
  <p>${siteName} aims to correct factual errors promptly. When a material error is identified, the article can be updated and the correction recorded with the article's updated timestamp.</p>
  <p>To report an error, provide the article URL and identify the specific statement that needs correction.</p>
`;

export const advertisingDisclosureHtml = ({ siteName }) => `
  <p>${siteName} may eventually be supported by advertising and affiliate relationships. Any paid placement, sponsorship, or affiliate relationship will be identified clearly where it appears.</p>
  <p>Advertising and affiliate relationships do not determine the editorial conclusions of articles.</p>
`;

export const privacyHtml = ({ siteName, domain }) => `
  <p><em>Last updated: August 29, 2026</em></p>
  <p>This policy describes how ${siteName} (${domain}) handles information when you visit the site.</p>
  <h2>Information we collect</h2>
  <ul>
    <li><strong>Site usage:</strong> The publication may use standard web analytics and server logs to understand traffic and improve the site.</li>
    <li><strong>Search:</strong> Searches performed on the site may be processed locally in the browser using the site's published search index.</li>
    <li><strong>Advertising:</strong> If advertising is enabled later, advertising providers may process information according to their own policies and applicable controls.</li>
  </ul>
  <h2>Your choices</h2>
  <p>You can control cookies and personalized advertising through your browser and the controls offered by advertising providers.</p>
  <h2>Changes</h2>
  <p>This policy may be updated as site features and services change. The date above identifies the current version.</p>
`;

export const termsHtml = ({ siteName }) => `
  <p><em>Last updated: August 29, 2026</em></p>
  <p>By using ${siteName}, you agree to use the site for lawful purposes and to treat its content as informational material.</p>
  <h2>Content</h2>
  <p>Articles reflect information available when they were published and may become outdated. Content is not professional financial, legal, medical, or other specialized advice.</p>
  <h2>Intellectual property</h2>
  <p>Site content is owned by ${siteName} or used under the applicable license or attribution. You may link to articles and quote brief excerpts with attribution.</p>
  <h2>Availability</h2>
  <p>The publication may change, update, or remove content and features without notice.</p>
`;
