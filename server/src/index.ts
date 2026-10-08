import { defineRoom, defineServer } from "colyseus";
import { ProvinceRoom } from "./rooms/ProvinceRoom";

const port = Number(process.env.SERVER_PORT ?? 2567);

const server = defineServer({
  rooms: {
    province: defineRoom(ProvinceRoom),
  },
});

await server.listen(port);
console.log(`Edge of Empire server listening on :${port}`);
