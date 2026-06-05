use std::path::{Path, PathBuf};

pub const MAX_PATH_LEN: usize = 260;

pub fn validate_path_length(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    if path_str.len() > MAX_PATH_LEN {
        Err(format!(
            "文件路径超长（{} 字符，最大允许 {} 字符）：{}",
            path_str.len(),
            MAX_PATH_LEN,
            path_str
        ))
    } else {
        Ok(())
    }
}

pub fn canonicalize_path(path: &Path) -> Result<PathBuf, String> {
    dunce::canonicalize(path).map_err(|e| format!("无法解析路径 '{}': {}", path.display(), e))
}

pub fn to_unicode_path(path: &Path) -> Result<PathBuf, String> {
    if cfg!(target_os = "windows") {
        let path_str = path.to_string_lossy().to_string();
        if path_str.starts_with(r"\\?\") {
            Ok(path.to_path_buf())
        } else {
            let unc = format!(r"\\?\{}", path_str);
            Ok(PathBuf::from(unc))
        }
    } else {
        Ok(path.to_path_buf())
    }
}

pub fn ensure_output_dir(output_dir: &Path) -> Result<PathBuf, String> {
    if !output_dir.exists() {
        std::fs::create_dir_all(output_dir)
            .map_err(|e| format!("无法创建输出目录 '{}': {}", output_dir.display(), e))?;
    }
    validate_path_length(output_dir)?;
    canonicalize_path(output_dir)
}

pub fn generate_output_path(output_dir: &Path, original: &Path, suffix: &str, ext: Option<&str>) -> Result<PathBuf, String> {
    let file_stem = original
        .file_stem()
        .ok_or_else(|| format!("无法获取文件名: {}", original.display()))?
        .to_string_lossy()
        .to_string();

    let extension = match ext {
        Some(e) => e.to_string(),
        None => original.extension()
            .map(|e| e.to_string_lossy().to_string())
            .unwrap_or_default(),
    };

    let output_name = if suffix.is_empty() {
        format!("{}.{}", file_stem, extension)
    } else {
        format!("{}_{}.{}", file_stem, suffix, extension)
    };

    let output_path = output_dir.join(&output_name);
    validate_path_length(&output_path)?;
    Ok(output_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_normal_path() {
        let path = Path::new("C:\\Users\\test\\image.jpg");
        assert!(validate_path_length(path).is_ok());
    }
}
