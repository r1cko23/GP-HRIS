CREATE PROCEDURE [dbo].[usp_combocuttoff_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
 SELECT DISTINCT date_start, CONVERT(VARCHAR, Date_Start, 101) + ' To ' + CONVERT(VARCHAR, Date_End, 101) AS cuttoff
    FROM payroll_summary  
	WHERE idclientp = @idclient
	order by Date_Start desc

END