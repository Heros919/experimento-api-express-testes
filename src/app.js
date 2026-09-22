const DUMMY_JSON_URL = "https://dummyjson.com";
const defaultQueryExternal = (path, options) =>
 fetch(`${DUMMY_JSON_URL}${path}`, options);

const parseLimit = (value) => {
 if (value === undefined) return 10;
 if (typeof value !== "string" || !/^\d+$/.test(value) || Number(value) < 1) {
 return null;
 }
 return Number(value);
};

const createApp = ({ queryExternal = defaultQueryExternal } = {}) => {
 const express = require("express");
 const app = express();

 app.use(express.json());
 app.use((req, res, next) => {
 console.log(`${req.method} ${req.originalUrl} ${new Date().toISOString()}`);
 next();
 });

 app.get("/api/products", async (req, res) => {
 const limit = parseLimit(req.query.limit);
 if (limit === null) {
 return res.status(400).json({ error: "O parâmetro limit deve ser um inteiro positivo" });
 }
 try {
 const response = await queryExternal(`/products?limit=${limit}`);
 if (!response.ok) {
 return res.status(502).json({ error: "Não foi possível consultar a API externa" });
 }
 return res.status(200).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao consultar produtos" });
 }
 });

 app.get("/api/products/search", async (req, res) => {
 const { q } = req.query;
 if (typeof q !== "string" || !q.trim()) {
 return res.status(400).json({ error: "O parâmetro q é obrigatório" });
 }
 try {
 const response = await queryExternal(`/products/search?q=${encodeURIComponent(q)}`);
 if (!response.ok) return res.status(502).json({ error: "Erro na API externa" });
 return res.status(200).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao consultar produtos" });
 }
 });

 app.get("/api/products/category/:category", async (req, res) => {
 try {
 const response = await queryExternal(
 `/products/category/${encodeURIComponent(req.params.category)}`
 );
 if (response.status === 404) return res.status(404).json({ error: "Categoria não encontrada" });
 if (!response.ok) return res.status(502).json({ error: "Erro na API externa" });
 return res.status(200).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao consultar categoria" });
 }
 });

 app.get("/api/products/:id", async (req, res) => {
 try {
 const response = await queryExternal(`/products/${req.params.id}`);
 if (response.status === 404) return res.status(404).json({ error: "Produto não encontrado" });
 if (!response.ok) return res.status(502).json({ error: "Erro na API externa" });
 return res.status(200).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao consultar produto" });
 }
 });

 app.post("/api/products", async (req, res) => {
 const { title, price, category } = req.body;
 if (!title || price === undefined) {
 return res.status(400).json({ error: "Os campos title e price são obrigatórios" });
 }
 if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
 return res.status(400).json({ error: "O preço deve ser um número não negativo" });
 }
 try {
 const response = await queryExternal("/products/add", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({ title, price, category })
 });
 if (!response.ok) return res.status(502).json({ error: "Não foi possível salvar o produto" });
 return res.status(201).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao salvar produto" });
 }
 });

 app.delete("/api/products/:id", async (req, res) => {
 try {
 const response = await queryExternal(`/products/${req.params.id}`, { method: "DELETE" });
 if (response.status === 404) return res.status(404).json({ error: "Produto não encontrado" });
 if (!response.ok) return res.status(502).json({ error: "Não foi possível excluir o produto" });
 return res.status(200).json(await response.json());
 } catch (error) {
 return res.status(500).json({ error: "Erro interno ao excluir produto" });
 }
 });

 return app;
};

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;