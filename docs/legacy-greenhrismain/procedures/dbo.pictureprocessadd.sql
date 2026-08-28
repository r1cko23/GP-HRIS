-- =============================================
-- Author:		<Pat Relos>
-- Create date: <2-23-2025>
-- Description:	<Saving picture>
-- =============================================
create PROCEDURE [dbo].[pictureprocessadd]
    @employeeid INT,
    @imagepic VARBINARY(MAX) 
AS	
BEGIN
    SET NOCOUNT ON;

    INSERT INTO tblpicture (employee_id, pictureimage)
    VALUES (@employeeid, @imagepic);
END


