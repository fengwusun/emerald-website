import test from "node:test";
import assert from "node:assert/strict";
import { groupTargetProducts } from "../lib/product-groups";

const file = (key: string) => `/api/targets/file?file=${key}`;
const image = (key: string) => `/api/targets/image?file=${key}`;

test("groupTargetProducts turns assets into compact rows with short buttons", () => {
  const pipelinePng = "emerald_grating_plots/jw07935003001_F290LP-G395M_s000008821.png";
  const pipelineX1d = "emerald_grating_plots/jw07935003001_F290LP-G395M_s000008821_x1d.fits";
  const pipelineJson = "emerald_grating_plots/jw07935003001_F290LP-G395M_s000008821_x1d.json";
  const bundleStem = "EMERALDv0.2a/jw_o003_7935_8821_F290LP_G395M_MULTIPLE_bundle";
  const chart = "targets/EMR-8821/images/7935-obs3_ID-1008821.jpg";

  const groups = groupTargetProducts([
    { asset_type: "image", label: "OBS3 Source Image", storage_key: chart, preview_url: image("7935-obs3_ID-1008821.jpg"), access_level: "team" },
    { asset_type: "spectrum", label: "Plot", storage_key: pipelinePng, preview_url: image(pipelinePng), access_level: "team" },
    { asset_type: "spectrum", label: "1D FITS", storage_key: pipelineX1d, preview_url: file(pipelineX1d), access_level: "team" },
    { asset_type: "spectrum", label: "1D JSON", storage_key: pipelineJson, access_level: "team" },
    { asset_type: "other", label: "Bundle CSV", storage_key: `${bundleStem}_1d.csv`, preview_url: file(`${bundleStem}_1d.csv`), access_level: "team" },
    { asset_type: "other", label: "Bundle FITS", storage_key: `${bundleStem}.fits`, preview_url: file(`${bundleStem}.fits`), access_level: "team" },
    { asset_type: "spectrum", label: "Bundle PNG", storage_key: `${bundleStem}.png`, preview_url: image(`${bundleStem}.png`), access_level: "team" }
  ]);

  assert.deepEqual(
    groups.map((group) => group.title),
    ["EMERALD G395M · pipeline reduction", "EMERALD G395M · SMILES v0.2a bundle", "MSA finding charts"]
  );

  const [pipeline, bundle, charts] = groups;
  assert.equal(pipeline.rows.length, 1);
  assert.equal(pipeline.rows[0].tag, "o003");
  assert.deepEqual(pipeline.rows[0].buttons.map((button) => button.label), ["1D FITS"]);
  assert.equal(pipeline.rows[0].preview?.storageKey, pipelinePng);

  assert.equal(bundle.rows[0].tag, "o003 · MULTIPLE");
  assert.deepEqual(bundle.rows[0].buttons.map((button) => button.label), ["Bundle FITS", "1D CSV"]);
  assert.equal(bundle.rows[0].preview?.storageKey, `${bundleStem}.png`);
  assert.ok(bundle.note?.includes("SMBG"));

  assert.deepEqual(charts.thumbnails.map((thumbnail) => thumbnail.label), ["obs 3"]);
});

test("groupTargetProducts keeps early DIVER grating files out of the SMILES bundle groups", () => {
  const csv = "diver_grating_plots/jw_o001_8018_1003167_F070LP_G140M_MULTIPLE_bundle_1d.csv";
  const plot = "diver_grating_plots/spectrum_plot_1003167.png";
  const groups = groupTargetProducts([
    { asset_type: "spectrum", label: "Plot", storage_key: plot, preview_url: image(plot), access_level: "team" },
    { asset_type: "spectrum", label: "CSV a", storage_key: csv, spectrum_profile: "flux_a_cgs", preview_url: file(csv), access_level: "team" },
    { asset_type: "spectrum", label: "CSV b", storage_key: csv, spectrum_profile: "flux_b_cgs", preview_url: file(csv), access_level: "team" }
  ]);
  assert.deepEqual(groups.map((group) => group.title), ["DIVER G140M · early reduction"]);
  assert.equal(groups[0].rows.length, 1);
  assert.equal(groups[0].rows[0].tag, "o001");
  assert.deepEqual(groups[0].rows[0].buttons.map((button) => button.label), ["1D CSV"]);
  assert.equal(groups[0].rows[0].preview?.storageKey, plot);
});
