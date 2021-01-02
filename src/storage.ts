import NodePersist, { LocalStorage } from "node-persist";

class Storage {
  private strg: LocalStorage;
  constructor() {
    this.strg = NodePersist.create({ dir: "/tmp/appdata" });
  }

  get storage(): LocalStorage {
    return this.strg;
  }
}

let instance: LocalStorage = new Storage().storage;
export default instance;
