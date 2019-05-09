const config  = require('config'),
      path = require("path"),
      fs = require("fs"),
      sizeOf = require('image-size')
;
const base_dir = config.moderation.regionOCRModeration.base_dir;
const img = path.join(base_dir, "/img/");
const ann = path.join(base_dir, "/ann/");

function chencheAnnotation (img, ann, chended_numbers, template) {
    if (chended_numbers === undefined) {
        return;
    }

    chended_numbers.forEach(function (numberData) {
        let annotationPath = path.join(
            ann,
            numberData.name,
        ) + '.json';
        let imgPath = path.join(base_dir, numberData.img_path);

        if (numberData.deleted) {
            if (fs.existsSync(annotationPath)) {
                fs.unlinkSync(annotationPath);
            }
            fs.unlinkSync(imgPath);
            return;
        }
        const dimensions = sizeOf(imgPath);
        Object.assign(numberData, template, {
            moderation: {isModerated: 1},
            size: {
                width: dimensions.width,
                height: dimensions.height
            }
        });
        fs.writeFileSync(annotationPath, JSON.stringify(numberData));
    });
}

module.exports = function(ctx, next) {
    const max_files_count = ctx.request.body.max_count || 100;
    const chended_numbers = ctx.request.body.chended_numbers;

    let template = Object.assign({}, config.moderation.template);

    // checkers
    if (!fs.existsSync(base_dir)) {
        ctx.body = {
            message: `Path to '${base_dir}' not exists`
        };
    }
    if (!fs.existsSync(img)) {
        fs.mkdirSync(img);
        ctx.body = {
            message: `Image dir '${img}' empty`
        };
    }

    if (!ctx.body) {
        if (!fs.existsSync(ann)) {
            fs.mkdirSync(ann);
        }
        chencheAnnotation(img, ann, chended_numbers, template);

        console.log(template);
        const files = fs.readdirSync(img);

        const res = [];
        let count = 0;
        for (let i in files) {

            const f = files[i];
            // more reliable way
            const number = path.basename(f, path.extname(f));

            const jsonPath = path.join(ann, `${number}.json`);
            const imgPath = path.join(img, `${number}.png`);

            let data = {};
            if (!fs.existsSync(jsonPath)) {
                data = template;
            } else {
                data = Object.assign({}, template, JSON.parse(fs.readFileSync(jsonPath)));
            }
            if (!data.moderation || !data.moderation.isModerated) {
                const data_item = {
                    img_path: `img/${f}`,
                    name: number,
                    predicted: data.moderation === undefined ? "" : data.moderation.predicted || "",
                    description: data.description,
                };
                console.log(data_item);
                const options = config.moderation.regionOCRModeration.options;
                for (let key in options) {
                    data_item[key] = data[key];
                }
                res.push(data_item)
            } else {
                count++;
            }
        }

        //console.log(iter);
        ctx.body = {
            expectModeration: files.length - count,
            data:res.slice(0, max_files_count),
            options: config.moderation.regionOCRModeration.options,
            user: template.moderation.moderatedBy || "defaultUser"
        };
        console.log("___________________");
    }

    next();
};