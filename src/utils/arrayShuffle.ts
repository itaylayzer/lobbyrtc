export function arrayShuffle<T>(arr: Array<T>) {
    for (let i = 0; i < arr.length; i++) {
        var rnd = Math.min(arr.length - 1, Math.floor(Math.random() * arr.length));

        var temp = arr[i];
        arr[i] = arr[rnd];
        arr[rnd] = temp;
    }

    return arr;
}