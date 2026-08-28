create PROCEDURE [dbo].[usp_comboemployee_Listwithemail] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT DISTINCT Employee_id, 
       COALESCE(lname, '') + N', ' + COALESCE(fname, '') AS Fullname,
       lname,  -- Required for ORDER BY
       fname   -- Required for ORDER BY
FROM Employee
WHERE idclient = @idclient and pri_email <> ''
ORDER BY lname, fname;



END
