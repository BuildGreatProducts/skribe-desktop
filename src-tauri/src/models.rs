use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

const DEFAULT_GLOBAL_WRITING_INSTRUCTIONS: &str = r#"Write like a careful human editor, not a content bot.
- Use plain, concrete language; cut throat-clearing, filler, hedging, and generic summaries.
- Vary rhythm with short and long sentences. Let occasional fragments stand when natural.
- Prefer specific examples, texture, and a clear point of view over vague balanced claims.
- Avoid stock AI phrases like "delve", "leverage", "landscape", "it is important to note", and "in conclusion".
- Never invent personal experience, facts, or sources."#;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownFile {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub size: u64,
    pub modified_at: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorSettings {
    pub font_size: u16,
    pub accent_color: String,
    pub line_height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiSettings {
    pub file_tree_width: u16,
    pub show_status_line: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSettings {
    #[serde(default = "default_true")]
    pub word_count: bool,
    #[serde(default = "default_true")]
    pub character_count: bool,
    #[serde(default = "default_true")]
    pub reading_level: bool,
}

fn default_true() -> bool {
    true
}

impl Default for WidgetSettings {
    fn default() -> Self {
        Self {
            word_count: true,
            character_count: true,
            reading_level: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    pub auto_focus_input_on_folder_open: bool,
    #[serde(default = "default_system_prompt")]
    pub system_prompt: String,
    #[serde(default)]
    pub project_writing_instructions: BTreeMap<String, String>,
}

fn default_system_prompt() -> String {
    DEFAULT_GLOBAL_WRITING_INSTRUCTIONS.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreflightSettings {
    pub claude_code_detected: bool,
    pub claude_code_version: Option<String>,
    pub last_detected_at: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub schema_version: u8,
    pub recent_folders: Vec<String>,
    pub last_opened_folder: Option<String>,
    pub editor: EditorSettings,
    pub ui: UiSettings,
    #[serde(default)]
    pub widgets: WidgetSettings,
    pub ai: AiSettings,
    pub preflight: PreflightSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            schema_version: 1,
            recent_folders: Vec::new(),
            last_opened_folder: None,
            editor: EditorSettings {
                font_size: 18,
                accent_color: "deep-ink".to_string(),
                line_height: 1.7,
            },
            ui: UiSettings {
                file_tree_width: 240,
                show_status_line: true,
            },
            widgets: WidgetSettings::default(),
            ai: AiSettings {
                auto_focus_input_on_folder_open: false,
                system_prompt: default_system_prompt(),
                project_writing_instructions: BTreeMap::new(),
            },
            preflight: PreflightSettings {
                claude_code_detected: false,
                claude_code_version: None,
                last_detected_at: 0,
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudePreflight {
    pub installed: bool,
    pub version: Option<String>,
    pub logged_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpStartResponse {
    pub session_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FsChangePayload {
    pub event: String,
    pub path: String,
}

#[cfg(test)]
mod tests {
    use super::AppSettings;

    #[test]
    fn deserializes_legacy_settings_with_defaults() {
        let settings = serde_json::from_str::<AppSettings>(
            r#"{
              "schemaVersion": 1,
              "recentFolders": [],
              "lastOpenedFolder": null,
              "editor": {
                "fontSize": 18,
                "accentColor": "deep-ink",
                "lineHeight": 1.7
              },
              "ui": {
                "fileTreeWidth": 240,
                "showStatusLine": true
              },
              "ai": {
                "autoFocusInputOnFolderOpen": false
              },
              "preflight": {
                "claudeCodeDetected": false,
                "claudeCodeVersion": null,
                "lastDetectedAt": 0
              }
            }"#,
        )
        .expect("legacy settings should deserialize");

        assert!(settings
            .ai
            .system_prompt
            .contains("Write like a careful human editor"));
        assert!(settings.ai.project_writing_instructions.is_empty());
        assert!(settings.widgets.word_count);
        assert!(settings.widgets.character_count);
        assert!(settings.widgets.reading_level);
    }

    #[test]
    fn deserializes_existing_widget_settings_with_character_count_default() {
        let settings = serde_json::from_str::<AppSettings>(
            r#"{
              "schemaVersion": 1,
              "recentFolders": [],
              "lastOpenedFolder": null,
              "editor": {
                "fontSize": 18,
                "accentColor": "deep-ink",
                "lineHeight": 1.7
              },
              "ui": {
                "fileTreeWidth": 240,
                "showStatusLine": true
              },
              "widgets": {
                "wordCount": false
              },
              "ai": {
                "autoFocusInputOnFolderOpen": false,
                "systemPrompt": ""
              },
              "preflight": {
                "claudeCodeDetected": false,
                "claudeCodeVersion": null,
                "lastDetectedAt": 0
              }
            }"#,
        )
        .expect("settings with older widget shape should deserialize");

        assert!(!settings.widgets.word_count);
        assert!(settings.widgets.character_count);
        assert!(settings.widgets.reading_level);
    }
}
