module.exports = function handler(_request, response) {
  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  const config = {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || ""
  };
  response.status(200).send(`window.TODO_MEMO_SUPABASE_CONFIG=${JSON.stringify(config)};`);
};
