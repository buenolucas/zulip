const rewiremock = require("rewiremock/node");

set_global('$', global.make_zjquery());
set_global('document', {
    location: { },
});
set_global('navigator', {
    userAgent: 'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)',
});
set_global('page_params', {
    max_file_upload_size: 25,
});
set_global('csrf_token', "csrf_token");
set_global('bridge', false);

// Setting these up so that we can test that links to uploads within messages are
// automatically converted to server relative links.
global.document.location.protocol = 'https:';
global.document.location.host = 'foo.com';

zrequire('compose_ui');
zrequire('compose_state');
zrequire('compose');
zrequire('compose_actions');

const plugin_stub = {
    prototype: {
        constructor: null,
    },
};

zrequire('upload');

run_test('make_upload_absolute', () => {
    let uri = "/user_uploads/5/d4/6lSlfIPIg9nDI2Upj0Mq_EbE/kerala.png";
    const expected_uri = "https://foo.com/user_uploads/5/d4/6lSlfIPIg9nDI2Upj0Mq_EbE/kerala.png";
    assert.equal(upload.make_upload_absolute(uri), expected_uri);

    uri = "https://foo.com/user_uploads/5/d4/6lSlfIPIg9nDI2Upj0Mq_EbE/alappuzha.png";
    assert.equal(upload.make_upload_absolute(uri), uri);
});

run_test('get_item', () => {
    assert.equal(upload.get_item("textarea", {mode: "compose"}), $('#compose-textarea'));
    assert.equal(upload.get_item("send_status_message", {mode: "compose"}), $('#compose-error-msg'));
    assert.equal(upload.get_item("file_input_identifier", {mode: "compose"}), "#file_input");
    assert.equal(upload.get_item("source", {mode: "compose"}), "compose-file-input");
    assert.equal(upload.get_item("drag_drop_container", {mode: "compose"}), $('#compose'));

    assert.equal(upload.get_item("textarea", {mode: "edit", row: 1}), $('#message_edit_content_1'));

    $('#message_edit_content_2').closest = () => {
        $('#message_edit_form').set_find_results('.message_edit_save', $('.message_edit_save'));
        return $('#message_edit_form');
    };
    assert.equal(upload.get_item("send_button", {mode: "edit", row: 2}), $('.message_edit_save'));

    assert.equal(upload.get_item("send_status_identifier", {mode: "edit", row: 11}), "#message-edit-send-status-11");
    assert.equal(upload.get_item("send_status", {mode: "edit", row: 75}), $("#message-edit-send-status-75"));

    $('#message-edit-send-status-2').set_find_results('.send-status-close', $('.send-status-close'));
    assert.equal(upload.get_item("send_status_close_button", {mode: "edit", row: 2}), $('.send-status-close'));

    $('#message-edit-send-status-22').set_find_results('.error-msg', $('.error-msg'));
    assert.equal(upload.get_item("send_status_message", {mode: "edit", row: 22}), $('.error-msg'));

    assert.equal(upload.get_item("file_input_identifier", {mode: "edit", row: 123}), "#message_edit_file_input_123");
    assert.equal(upload.get_item("source", {mode: "edit", row: 123}), "message-edit-file-input");
    assert.equal(upload.get_item("drag_drop_container", {mode: "edit", row: 1}), $("#message_edit_form"));

    assert.throws(
        () => {
            upload.get_item("textarea");
        },
        {
            name: "Error",
            message: "Missing config",
        }
    );
    assert.throws(
        () => {
            upload.get_item("textarea", {mode: "edit"});
        },
        {
            name: "Error",
            message: "Missing row in config",
        }
    );
    assert.throws(
        () => {
            upload.get_item("textarea", {mode: "blah"});
        },
        {
            name: "Error",
            message: "Invalid upload mode!",
        }
    );
    assert.throws(
        () => {
            upload.get_item("invalid", {mode: "compose"});
        },
        {
            name: "Error",
            message: 'Invalid key name for mode "compose"',
        }
    );
    assert.throws(
        () => {
            upload.get_item("invalid", {mode: "edit", row: 20});
        },
        {
            name: "Error",
            message: 'Invalid key name for mode "edit"',
        }
    );
});

run_test('hide_upload_status', () => {
    $('#compose-send-button').prop("disabled", "");
    $('#compose-send-status').addClass("alert-info").show();

    upload.hide_upload_status({mode: "compose"});

    assert.equal($('#compose-send-button').prop("disabled"), false);
    assert.equal($('#compose-send-button').hasClass("alert-info"), false);
    assert.equal($('#compose-send-button').visible(), false);
});

run_test('show_error_message', () => {
    $('#compose-send-button').prop("disabled", "");
    $('#compose-send-status').addClass("alert-info").removeClass("alert-error").hide();
    $('#compose-error-msg').text("");
    $('#compose-error-msg').hide();

    upload.show_error_message({mode: "compose"}, "Error message");
    assert.equal($('#compose-send-button').prop("disabled"), false);
    assert($('#compose-send-status').hasClass("alert-error"));
    assert.equal($('#compose-send-status').hasClass("alert-info"), false);
    assert($('#compose-send-status').visible());
    assert.equal($('#compose-error-msg').text(), "Error message");

    upload.show_error_message({mode: "compose"});
    assert.equal($('#compose-error-msg').text(), "translated: An unknown error occurred.");

});

run_test('upload_files', () => {
    let cancel_all_counter = 0;
    const files = [
        {
            name: "budapest.png",
            type: "image/png",
        },
    ];
    let uppy_add_file_called = false;
    const uppy = {
        cancelAll: () => {
            cancel_all_counter += 1;
        },
        addFile: (params) => {
            uppy_add_file_called = true;
            assert.equal(params.source, "compose-file-input");
            assert.equal(params.name, "budapest.png");
            assert.equal(params.type, "image/png");
            assert.equal(params.data, files[0]);
        },
    };
    let hide_upload_status_called = false;
    upload.hide_upload_status = (config) => {
        hide_upload_status_called = true;
        assert(config.mode, "compose");
    };
    const config =  {mode: "compose"};

    upload.upload_files(uppy, config, []);
    assert.equal(cancel_all_counter, 1);
    assert(hide_upload_status_called);

    page_params.max_file_upload_size = 0;
    let show_error_message_called = false;
    upload.show_error_message = (config, message) => {
        show_error_message_called = true;
        assert.equal(config.mode, "compose");
        assert.equal(message, "translated: File and image uploads have been disabled for this organization.");
    };
    upload.upload_files(uppy, config, files);
    assert(show_error_message_called);

    page_params.max_file_upload_size = 25;
    let on_click_close_button_callback;
    $(".compose-send-status-close").one = (event, callback) => {
        assert.equal(event, "click");
        on_click_close_button_callback = callback;
    };
    let compose_ui_insert_syntax_and_focus_called = false;
    compose_ui.insert_syntax_and_focus = (syntax, textarea) => {
        assert.equal(syntax, "[Uploading budapest.png…]()");
        assert.equal(textarea, $("#compose-textarea"));
        compose_ui_insert_syntax_and_focus_called = true;
    };
    let compose_ui_autosize_textarea_called = false;
    compose_ui.autosize_textarea = () => {
        compose_ui_autosize_textarea_called = true;
    };
    $("#compose-send-button").attr("disabled", false);
    $("#compose-send-status").removeClass("alert-info").hide();
    upload.upload_files(uppy, config, files);
    assert.equal($("#compose-send-button").attr("disabled"), '');
    assert($("#compose-send-status").hasClass("alert-info"));
    assert($("#compose-send-status").visible());
    assert.equal($("<p>").text(), 'translated: Uploading…');
    assert(compose_ui_insert_syntax_and_focus_called);
    assert(compose_ui_autosize_textarea_called);
    assert(uppy_add_file_called);

    global.patch_builtin("setTimeout", (func) => {
        func();
    });
    hide_upload_status_called = false;
    on_click_close_button_callback();
    assert.equal(cancel_all_counter, 2);
    assert(hide_upload_status_called);
});

run_test('uppy_config', () => {
    let uppy_stub_called = false;
    let uppy_set_meta_called = false;
    let uppy_used_xhrupload = false;
    let uppy_used_progressbar = false;

    function uppy_stub(config) {
        uppy_stub_called = true;
        assert.equal(config.debug, false);
        assert.equal(config.autoProceed, true);
        assert.equal(config.restrictions.maxFileSize, 25 * 1024 * 1024);
        assert.equal(Object.keys(config.locale.strings).length, 2);
        assert("exceedsSize" in config.locale.strings);

        return {
            setMeta: (params) => {
                uppy_set_meta_called = true;
                assert.equal(params.csrfmiddlewaretoken, 'csrf_token');
            },
            use: (func, params) => {
                const func_name = func.name;
                if (func_name === "XHRUpload") {
                    uppy_used_xhrupload = true;
                    assert.equal(params.endpoint, '/json/user_uploads');
                    assert.equal(params.formData, true);
                    assert.equal(params.fieldName, 'file');
                    assert.equal(params.limit, 5);
                    assert.equal(Object.keys(params.locale.strings).length, 1);
                    assert("timedOut" in params.locale.strings);
                } else if (func_name === "ProgressBar") {
                    uppy_used_progressbar = true;
                    assert.equal(params.target, '#compose-send-status');
                    assert.equal(params.hideAfterFinish, false);
                } else {
                    /* istanbul ignore next */
                    assert.fail(`Missing tests for ${func_name}`);
                }
            },
            on: () => {},
        };
    }
    uppy_stub.Plugin = plugin_stub;
    rewiremock.proxy(() => require("../../static/js/upload"), {'@uppy/core': uppy_stub});
    upload.setup_upload({mode: "compose"});

    assert.equal(uppy_stub_called, true);
    assert.equal(uppy_set_meta_called, true);
    assert.equal(uppy_used_xhrupload, true);
    assert.equal(uppy_used_progressbar, true);

});

run_test('file_input', () => {
    set_global('$', global.make_zjquery());

    upload.setup_upload({mode: "compose"});

    const change_handler = $("body").get_on_handler("change", "#file_input");
    const files = ["file1", "file2"];
    const event = {
        target: {
            files: files,
            value: "C:\fakepath\portland.png",
        },
    };
    let upload_files_called = false;
    upload.upload_files = (uppy, config, files) => {
        assert.equal(config.mode, "compose");
        assert.equal(files, files);
        upload_files_called = true;
    };
    change_handler(event);
    assert(upload_files_called);
});

run_test('file_drop', () => {
    set_global('$', global.make_zjquery());

    upload.setup_upload({mode: "compose"});

    let prevent_default_counter = 0;
    const drag_event = {
        preventDefault: () => {
            prevent_default_counter += 1;
        },
    };
    const dragover_handler = $("#compose").get_on_handler("dragover");
    dragover_handler(drag_event);
    assert.equal(prevent_default_counter, 1);

    const dragenter_handler = $("#compose").get_on_handler("dragenter");
    dragenter_handler(drag_event);
    assert.equal(prevent_default_counter, 2);

    const files = ["file1", "file2"];
    const drop_event = {
        preventDefault: () => {
            prevent_default_counter += 1;
        },
        originalEvent: {
            dataTransfer: {
                files: files,
            },
        },
    };
    const drop_handler = $("#compose").get_on_handler("drop");
    let upload_files_called = false;
    upload.upload_files = () => {upload_files_called = true;};
    drop_handler(drop_event);
    assert.equal(prevent_default_counter, 3);
    assert.equal(upload_files_called, true);
});

run_test('copy_paste', () => {
    set_global('$', global.make_zjquery());

    upload.setup_upload({mode: "compose"});

    const paste_handler = $("#compose").get_on_handler("paste");
    let get_as_file_called = false;
    let event = {
        originalEvent: {
            clipboardData: {
                items: [
                    {
                        kind: "file",
                        getAsFile: () => {
                            get_as_file_called = true;
                        },
                    },
                    {
                        kind: "notfile",
                    },
                ],
            },
        },
    };
    let upload_files_called = false;
    upload.upload_files = () => {
        upload_files_called = true;
    };

    paste_handler(event);
    assert(get_as_file_called);
    assert(upload_files_called);

    upload_files_called = false;
    event = {
        originalEvent: {},
    };
    paste_handler(event);
    assert.equal(upload_files_called, false);
});

run_test('uppy_events', () => {
    set_global('$', global.make_zjquery());
    const callbacks = {};
    let uppy_cancel_all_counter = 0;
    let state = {};

    function uppy_stub() {
        return {
            setMeta: () => {},
            use: () => {},
            cancelAll: () => {
                uppy_cancel_all_counter += 1;
            },
            on: (event_name, callback) => {
                callbacks[event_name] = callback;
            },
            getState: () => {
                return {
                    info: {
                        type: state.type,
                        details: state.details,
                        message: state.message,
                    },
                };
            },
        };
    }
    uppy_stub.Plugin = plugin_stub;
    rewiremock.proxy(() => require("../../static/js/upload"), {'@uppy/core': uppy_stub});
    upload.setup_upload({mode: "compose"});
    assert.equal(Object.keys(callbacks).length, 4);

    const on_upload_success_callback = callbacks["upload-success"];
    const file = {
        name: "copenhagen.png",
    };
    let response = {
        body: {
            uri: "/user_uploads/4/cb/rue1c-MlMUjDAUdkRrEM4BTJ/copenhagen.png",
        },
    };
    let compose_actions_start_called = false;
    compose_actions.start = () => {
        compose_actions_start_called = true;
    };
    let compose_ui_replace_syntax_called = false;
    compose_ui.replace_syntax = (old_syntax, new_syntax, textarea) => {
        compose_ui_replace_syntax_called = true;
        assert.equal(old_syntax, "[Uploading copenhagen.png…]()");
        assert.equal(new_syntax, "[copenhagen.png](https://foo.com/user_uploads/4/cb/rue1c-MlMUjDAUdkRrEM4BTJ/copenhagen.png)");
        assert.equal(textarea, $('#compose-textarea'));
    };
    let compose_ui_autosize_textarea_called = false;
    compose_ui.autosize_textarea = () => {
        compose_ui_autosize_textarea_called = true;
    };
    on_upload_success_callback(file, response);
    assert(compose_actions_start_called);
    assert(compose_ui_replace_syntax_called);
    assert(compose_ui_autosize_textarea_called);

    response = {
        body: {
            uri: undefined,
        },
    };
    compose_actions_start_called = false;
    compose_ui_replace_syntax_called = false;
    compose_ui_autosize_textarea_called = false;
    on_upload_success_callback(file, response);
    assert.equal(compose_actions_start_called, false);
    assert.equal(compose_ui_replace_syntax_called, false);
    assert.equal(compose_ui_autosize_textarea_called, false);

    const on_complete_callback = callbacks.complete;
    global.patch_builtin('setTimeout', (func) => {
        func();
    });
    let hide_upload_status_called = false;
    upload.hide_upload_status = () => {
        hide_upload_status_called = true;
    };
    assert.equal(uppy_cancel_all_counter, 0);
    on_complete_callback();
    assert.equal(uppy_cancel_all_counter, 1);
    assert(hide_upload_status_called);

    state = {
        type: "error",
        details: "Some Error",
        message: "Some error message",
    };
    const on_info_visible_callback = callbacks["info-visible"];
    let show_error_message_called = false;
    upload.show_error_message = (config, message) => {
        show_error_message_called = true;
        assert.equal(config.mode, "compose");
        assert.equal(message, "Some error message");
    };
    on_info_visible_callback();
    assert.equal(uppy_cancel_all_counter, 2);
    assert(show_error_message_called);

    state = {
        type: "error",
        message: "No Internet connection",
    };
    on_info_visible_callback();
    assert.equal(uppy_cancel_all_counter, 2);

    state = {
        type: "error",
        details: "Upload Error",
    };
    on_info_visible_callback();
    assert.equal(uppy_cancel_all_counter, 2);

    const on_upload_error_callback = callbacks["upload-error"];
    show_error_message_called = false;
    upload.show_error_message = (config, message) => {
        show_error_message_called = true;
        assert.equal(config.mode, "compose");
        assert.equal(message, "Response message");
    };
    response = {
        body: {
            msg: "Response message",
        },
    };
    on_upload_error_callback(null, null, response);
    assert.equal(uppy_cancel_all_counter, 3);
    assert(show_error_message_called);

    upload.show_error_message = (config, message) => {
        show_error_message_called = true;
        assert.equal(config.mode, "compose");
        assert.equal(message, null);
    };
    on_upload_error_callback(null, null);
    assert.equal(uppy_cancel_all_counter, 4);
    assert(show_error_message_called);
});
