const request = require("supertest");
const { createApp } = require("../src/app");

const product = { id: 1, title: "Phone", price: 499, category: "smartphones" };
const response = (body, status = 200) => ({
 ok: status >= 200 && status < 300,
 status,
 json: async () => body
});

describe("API de produtos", () => {
 let app;
 let queryExternal;

 beforeEach(() => {
 jest.spyOn(console, "log").mockImplementation(() => {});
 queryExternal = jest.fn(async (path, options = {}) => {
 if (path.startsWith("/products/search")) return response({ products: [product] });
 if (path.startsWith("/products/category")) return response({ products: [product] });
 if (path === "/products?limit=3") return response({ products: [product] });
 if (options.method === "DELETE") {
 return response({ ...product, isDeleted: true, deletedOn: "2026-09-22" });
 }
 if (path === "/products/1") return response(product);
 if (path === "/products/999999") return response({}, 404);
 if (path === "/products/add") {
 return response({ id: 2, title: "Produto de teste", price: 49.9, category: "testes" });
 }
 return response(product);
 });
 app = createApp({ queryExternal });
 });

 afterEach(() => {
 jest.restoreAllMocks();
 });

 describe("GET /api/products", () => {
 test("deve retornar uma lista de produtos", async () => {
 const response = await request(app)
 .get("/api/products?limit=3")
 .expect("Content-Type", /json/)
 .expect(200);
 expect(response.body).toHaveProperty("products");
 expect(Array.isArray(response.body.products)).toBe(true);
 expect(response.body.products.length).toBeGreaterThan(0);
 });

 test("deve rejeitar limit inválido", async () => {
 const result = await request(app).get("/api/products?limit=abc").expect(400);
 expect(result.body.error).toMatch(/limit/);
 expect(queryExternal).not.toHaveBeenCalled();
 });

 test("deve retornar 500 quando a API externa falhar", async () => {
 queryExternal.mockRejectedValueOnce(new Error("timeout"));
 const result = await request(app).get("/api/products").expect(500);
 expect(result.body).toEqual({ error: "Erro interno ao consultar produtos" });
 });

 test("deve retornar 502 quando a API externa responder com erro", async () => {
 queryExternal.mockResolvedValueOnce(response({}, 503));
 await request(app).get("/api/products").expect(502);
 });
 });

 describe("GET /api/products/search", () => {
 test("deve pesquisar produtos pelo termo", async () => {
 const result = await request(app).get("/api/products/search?q=phone").expect(200);
 expect(result.body.products).toEqual([product]);
 expect(queryExternal).toHaveBeenCalledWith("/products/search?q=phone");
 });

 test("deve exigir o parâmetro q", async () => {
 await request(app).get("/api/products/search").expect(400);
 });
 });

 describe("GET /api/products/category/:category", () => {
 test("deve listar produtos da categoria", async () => {
 const result = await request(app)
 .get("/api/products/category/smartphones")
 .expect(200);
 expect(result.body.products).toEqual([product]);
 });

 test("deve retornar 404 para categoria inexistente", async () => {
 queryExternal.mockResolvedValueOnce(response({}, 404));
 const result = await request(app)
 .get("/api/products/category/inexistente")
 .expect(404);
 expect(result.body).toEqual({ error: "Categoria não encontrada" });
 });
 });

 describe("GET /api/products/:id", () => {
 test("deve retornar um produto existente", async () => {
 const response = await request(app)
 .get("/api/products/1")
 .expect("Content-Type", /json/)
 .expect(200);
 expect(response.body).toHaveProperty("id");
 expect(response.body.id).toBe(1);
 expect(response.body).toHaveProperty("title");
 });
 test("deve retornar 404 para um produto inexistente", async () => {
 const response = await request(app)
 .get("/api/products/999999")
 .expect("Content-Type", /json/)
 .expect(404);
 expect(response.body).toEqual({
 error: "Produto não encontrado"
 });
 });

 test("deve retornar 502 quando houver erro na API do produto", async () => {
 queryExternal.mockResolvedValueOnce(response({}, 503));
 await request(app).get("/api/products/1").expect(502);
 });
 });
 describe("POST /api/products", () => {
 test("deve simular o salvamento de um produto", async () => {
 const newProduct = {
 title: "Produto de teste",
 price: 49.9,
 category: "testes"
 };
 const response = await request(app)
 .post("/api/products")
 .send(newProduct)
 .expect("Content-Type", /json/)
 .expect(201);
 expect(response.body).toHaveProperty("id");
 expect(response.body.title).toBe(newProduct.title);
 expect(response.body.price).toBe(newProduct.price);
 });
 test("deve rejeitar produto sem título", async () => {
 const response = await request(app)
 .post("/api/products")
 .send({
 price: 20
 })
 .expect("Content-Type", /json/)
 .expect(400);
 expect(response.body).toEqual({
 error: "Os campos title e price são obrigatórios"
 });
 });

 test("deve rejeitar preço negativo", async () => {
 const result = await request(app)
 .post("/api/products")
 .send({ title: "Produto inválido", price: -1 })
 .expect(400);
 expect(result.body).toEqual({ error: "O preço deve ser um número não negativo" });
 expect(queryExternal).not.toHaveBeenCalled();
 });

 test("deve rejeitar preço que não seja numérico", async () => {
 await request(app)
 .post("/api/products")
 .send({ title: "Produto inválido", price: "10" })
 .expect(400);
 });

 test("deve retornar 502 se o salvamento falhar na API externa", async () => {
 queryExternal.mockResolvedValueOnce(response({}, 503));
 await request(app)
 .post("/api/products")
 .send({ title: "Produto", price: 10 })
 .expect(502);
 });
 });
 describe("DELETE /api/products/:id", () => {
 test("deve simular a exclusão de um produto", async () => {
 const response = await request(app)
 .delete("/api/products/1")
 .expect("Content-Type", /json/)
 .expect(200);
 expect(response.body).toHaveProperty("id");
 expect(response.body.id).toBe(1);
 expect(response.body.isDeleted).toBe(true);
 expect(response.body).toHaveProperty("deletedOn");
 });

 test("deve retornar 404 ao excluir produto inexistente", async () => {
 queryExternal.mockResolvedValueOnce(response({}, 404));
 await request(app).delete("/api/products/999999").expect(404);
 });
 });

 test("deve registrar método, URL e horário da requisição", async () => {
 await request(app).get("/api/products?limit=3");
 expect(console.log).toHaveBeenCalledWith(
 expect.stringMatching(/^GET \/api\/products\?limit=3 \d{4}-\d{2}-\d{2}T/)
 );
 });
});