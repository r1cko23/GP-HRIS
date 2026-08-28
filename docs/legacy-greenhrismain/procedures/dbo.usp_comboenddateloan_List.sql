create PROCEDURE [dbo].[usp_comboenddateloan_List] 
	-- Add the parameters for the stored procedure here
		@idclient integer
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
SET NOCOUNT ON;

CREATE TABLE #TempTableloanENDdate (
[ID] INT IDENTITY(1, 1) PRIMARY KEY,
[idclient]int,
dateend date	  
);

CREATE INDEX idx_enddate ON #TempTableloanENDdate (dateend);	

IF @idclient >0
	begin

		--SELECT DISTINCT loanschedule.dateto, loan.idclientloan
		--FROM            loanschedule INNER JOIN
        --                loan ON loanschedule.idloan = loan.idloan
		--				 where idclientloan = @idclient
		--ORDER BY CONVERT(DATE, loanschedule.dateto, 101) DESC
	
	INSERT INTO #TempTableloanenddate (dateend)
		--use view table here to summarize data
		SELECT DISTINCT dateto
		FROM            View_dateendloan
		WHERE        (idclientloan = @idclient)

		select * from #TempTableloanENDdate order by dateend desc
		DROP TABLE #TempTableloanENDdate;
				  	
	
	
	
	end
	
else IF @idclient=0 or @idclient = '' 
	begin

--		SELECT DISTINCT loanschedule.dateto, loan.idclientloan
--	FROM            loanschedule INNER JOIN
--                         loan ON loanschedule.idloan = loan.idloan
--		ORDER BY CONVERT(DATE, loanschedule.dateto, 101) DESC
	
		INSERT INTO #TempTableloanENDdate (dateend)		
		SELECT    distinct dateTO
		FROM            View_dateendloan
		
		select * from #TempTableloanENDdate order by dateend desc

	
	
	end


END;