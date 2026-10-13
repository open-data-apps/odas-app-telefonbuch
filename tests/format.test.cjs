const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const noop = () => {};
const Papa = require(path.join(__dirname, "../app/vendor/papaparse/papaparse.min.js"));
const c = vm.createContext({ console, Papa, window: { location: { href: "https://fixture.test/app/", pathname: "/app/" }, addEventListener: noop },
  document: { addEventListener: noop, querySelector: () => null, querySelectorAll: () => [] } });
vm.runInContext(fs.readFileSync(path.join(__dirname, "../app/app.js"), "utf8"), c);

// F-112: Fehlerseiten dürfen nicht als CSV-Kontakte erscheinen, auch ohne <html>-Anfang.
for (const html of ["<!-- Fehler --><p>503</p>", "<div class=\"err\">Service Unavailable</div>", "<?xml version=\"1.0\"?><error/>", "<html><body>x</body></html>"]) {
  test("HTML/XML wird abgelehnt: " + html.slice(0, 20), () => {
    assert.throws(() => c.tbNormalisiereDatensaetze(html), /HTML|Antwortformat/);
  });
}
test("normale CSV bleibt lesbar", () => {
  const r = c.tbNormalisiereDatensaetze("Name;Stelle;Telefon\nAlice;Amt;0123");
  assert.equal(r.eintraege.length, 1);
});
