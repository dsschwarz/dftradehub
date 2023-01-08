module.exports = {
    trace: async function trace(traceName, block) {
        const startTime = Date.now();
        console.log("Starting trace", traceName);
        const result = await block();
        console.log(`Finished trace, time: ${Date.now() - startTime}`, traceName)
        return result;
    }
}