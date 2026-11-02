'use strict';
// Product constants. Fill gumroadProductId after creating the Pro product on Gumroad
// (Gumroad → product → Settings → "Product ID"), or keep the permalink.
module.exports = {
  name: 'PromptGate',
  version: '1.0.0',
  url: 'https://thequietconcierge.gumroad.com/l/promptgate',
  gumroadPermalink: 'promptgate',
  gumroadProductId: process.env.PROMPTGATE_GUMROAD_PRODUCT_ID || '',
  repo: 'https://github.com/huuthanhueh-debug/promptgate',
};