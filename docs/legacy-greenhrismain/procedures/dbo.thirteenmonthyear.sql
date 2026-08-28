create PROCEDURE [dbo].[thirteenmonthyear]
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

--payrolldate field shows dd/mm/yyyy format in payroll report so that create another columns called payrolldate1 that convert to a mm/dd/yyy 101 in short  

SELECT DISTINCT thirteenmonthyear
FROM            payroll_summary
where thirteenmonthyear<>''
ORDER BY thirteenmonthyear DESC



END