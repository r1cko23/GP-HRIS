CREATE PROCEDURE [dbo].[usp_comboemployee_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT DISTINCT Employee_id, lname +N', '+ fname AS Fullname
FROM            Employee where idclient = @idclient


END